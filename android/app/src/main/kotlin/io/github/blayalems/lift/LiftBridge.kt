package io.github.blayalems.lift

import android.Manifest
import android.app.*
import android.content.ClipData
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import android.view.HapticFeedbackConstants
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Exposed to the PWA as `window.LiftAndroid`.
 *
 * On API 35+ (Android 15+), workout state is routed through WorkoutService so the
 * notification runs under a foreground service — required for the Android 16 Live Update
 * status-bar chip. On API 26-34 notifications are posted directly via
 * NotificationManagerCompat, keeping all foreground-service crash vectors off those devices.
 */
class LiftBridge(private val context: Context) {

    companion object {
        const val NOTIF_ID   = 42
        const val CHANNEL_ID = "lift_workout"
        private const val LIFT_PINK = 0xFFE63B5D.toInt()
        private const val TAG = "LiftBridge"
    }

    init {
        createChannel()
    }

    @JavascriptInterface
    fun onWorkoutState(json: String) {
        val snap = runCatching { JSONObject(json) }.getOrNull() ?: return
        if (snap.optString("phase") == "idle") {
            clearWorkout()
            return
        }
        LiftWidgetProvider.updateAll(context, snap)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            // @JavascriptInterface runs on a WebView background thread; startForegroundService
            // must be called from the main thread on API 35+ or the system throws.
            // Fall back to direct notify if the service can't start for any reason.
            val serviceIntent = Intent(context, WorkoutService::class.java).apply {
                action = WorkoutService.ACTION_UPDATE
                putExtra(WorkoutService.EXTRA_SNAP, json)
            }
            Handler(Looper.getMainLooper()).post {
                try {
                    context.startForegroundService(serviceIntent)
                } catch (e: Exception) {
                    postFallbackNotification(snap)
                }
            }
        } else {
            postFallbackNotification(snap)
        }
    }

    @JavascriptInterface
    fun clearWorkout() {
        LiftWidgetProvider.updateAll(context, null)
        Handler(Looper.getMainLooper()).post {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                runCatching { context.stopService(Intent(context, WorkoutService::class.java)) }
                runCatching { NotificationManagerCompat.from(context).cancel(NOTIF_ID) }
            }
            runCatching { NotificationManagerCompat.from(context).cancel(NOTIF_ID) }
        }
    }

    @JavascriptInterface
    fun isNative(): Boolean = true

    @JavascriptInterface
    fun saveBackupFile(filename: String, json: String) {
        try {
            val safeName = cleanFilename(filename, "lift-backup.json", ".json")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                    put(MediaStore.Downloads.MIME_TYPE, "application/json")
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val resolver = context.contentResolver
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: throw Exception("MediaStore insert returned null")
                try {
                    resolver.openOutputStream(uri)
                        ?.use { it.write(json.toByteArray(Charsets.UTF_8)) }
                        ?: throw Exception("MediaStore output stream returned null")
                    values.clear()
                    values.put(MediaStore.Downloads.IS_PENDING, 0)
                    resolver.update(uri, values, null, null)
                } catch (e: Exception) {
                    runCatching { resolver.delete(uri, null, null) }
                    throw e
                }
            } else {
                val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                dir.mkdirs()
                File(dir, safeName).writeText(json, Charsets.UTF_8)
            }
            (context as? Activity)?.runOnUiThread {
                Toast.makeText(context, "Backup saved to Downloads/$safeName", Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            (context as? Activity)?.runOnUiThread {
                Toast.makeText(context, "Backup save failed: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    @JavascriptInterface
    fun saveImageFile(filename: String, dataUrl: String) {
        try {
            val safeName = cleanFilename(filename, "lift-workout.png", ".png")
            val bytes = decodeDataUrl(dataUrl)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                    put(MediaStore.Downloads.MIME_TYPE, "image/png")
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val resolver = context.contentResolver
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: throw Exception("MediaStore insert returned null")
                try {
                    resolver.openOutputStream(uri)
                        ?.use { it.write(bytes) }
                        ?: throw Exception("MediaStore output stream returned null")
                    values.clear()
                    values.put(MediaStore.Downloads.IS_PENDING, 0)
                    resolver.update(uri, values, null, null)
                } catch (e: Exception) {
                    runCatching { resolver.delete(uri, null, null) }
                    throw e
                }
            } else {
                val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                dir.mkdirs()
                File(dir, safeName).writeBytes(bytes)
            }
            (context as? Activity)?.runOnUiThread {
                Toast.makeText(context, "Image saved to Downloads/$safeName", Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            (context as? Activity)?.runOnUiThread {
                Toast.makeText(context, "Image save failed: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    @JavascriptInterface
    fun shareText(title: String, text: String): Boolean {
        val safeTitle = title.ifBlank { "Share Lift log" }
        val sendIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TITLE, safeTitle)
            putExtra(Intent.EXTRA_SUBJECT, safeTitle)
            putExtra(Intent.EXTRA_TEXT, text)
        }
        return launchShare(sendIntent, safeTitle)
    }

    @JavascriptInterface
    fun shareJsonFile(filename: String, json: String, title: String): Boolean =
        shareCacheFile(
            cleanFilename(filename, "lift-backup.json", ".json"),
            json.toByteArray(Charsets.UTF_8),
            "application/json",
            title.ifBlank { "Share Lift backup" },
        )

    @JavascriptInterface
    fun shareImageFile(filename: String, dataUrl: String, title: String): Boolean =
        runCatching {
            shareCacheFile(
                cleanFilename(filename, "lift-workout.png", ".png"),
                decodeDataUrl(dataUrl),
                "image/png",
                title.ifBlank { "Share Lift image" },
            )
        }.getOrElse { err ->
            showToast("Image share failed: ${err.message}", long = true)
            false
        }

    @JavascriptInterface
    fun haptic(patternJson: String): Boolean {
        val pattern = parseHapticPattern(patternJson)
        val decor = (context as? Activity)?.window?.decorView
        val vibrator = getVibrator()
        return try {
            if (pattern.size <= 1) {
                Handler(Looper.getMainLooper()).post {
                    decor?.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
                }
                return true
            }
            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val effect = VibrationEffect.createWaveform(longArrayOf(0L, *pattern), -1)
                    vibrator.vibrate(effect)
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(longArrayOf(0L, *pattern), -1)
                }
                true
            } else {
                Handler(Looper.getMainLooper()).post {
                    decor?.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
                }
                true
            }
        } catch (e: Exception) {
            Handler(Looper.getMainLooper()).post {
                decor?.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
            }
            false
        }
    }

    // ── Notification builder ──────────────────────────────────────────────────

    private fun buildNotification(snap: JSONObject): Notification {
        if (Build.VERSION.SDK_INT >= 36) {
            val progress = runCatching { buildProgressStyleNotification(context, snap, CHANNEL_ID) }
            progress.getOrNull()?.let { return it }
            progress.exceptionOrNull()?.let { err ->
                Log.w(TAG, "Progress-style notification failed; falling back to compat", err)
            }
        }
        val phase         = snap.optString("phase", "set-up-next")
        val dayTitle      = snap.optString("dayTitle", "Workout")
        val exName        = snap.optString("exName", "")
        val setIndex      = snap.optInt("setIndex", 1)
        val totalSets     = snap.optInt("totalSets", 1)
        val curEx         = snap.optInt("currentExercise", 1)
        val totEx         = snap.optInt("totalExercises", 1)
        val weightText    = snap.optString("weightText", "")
        val repsText      = snap.optString("repsText", "")
        val unitLabel     = snap.optString("unitLabel", "kg")
        val restRemaining = snap.optLong("restRemainingSec", 0L)
        val elapsedMin    = snap.optInt("elapsedMin", 0)
        val startedAt     = snap.optLong("startedAt", 0L)

        val exProgress = "Ex $curEx/$totEx"
        val setDetail  = if (weightText.isNotEmpty() && repsText.isNotEmpty())
            "$weightText $unitLabel × $repsText" else ""

        val (title, body) = when (phase) {
            "resting" -> {
                val m = restRemaining / 60; val s = restRemaining % 60
                "Resting — %d:%02d".format(m, s) to
                    "$exProgress · $exName · Set $setIndex/$totalSets · $setDetail".trim(' ', '·')
            }
            "rest-done" ->
                "Rest done ✓" to
                    "$exProgress · $exName · Set $setIndex/$totalSets · $setDetail — ready!".trim(' ', '·')
            "complete" ->
                "Workout complete" to "$exProgress · Finish workout when ready"
            else ->
                dayTitle to
                    "$exProgress · ${exName.ifEmpty { "Workout running" }} · $elapsedMin min"
        }

        val openPi = PendingIntent.getActivity(
            context, 0,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_dumbbell)
            .setContentTitle(title)
            .setContentText(body)
            .setColor(LIFT_PINK)
            .setColorized(true)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openPi)
            .setOnlyAlertOnce(true)

        when (phase) {
            "resting" -> builder
                .setUsesChronometer(true)
                .setChronometerCountDown(true)
                .setWhen(System.currentTimeMillis() + restRemaining * 1000L)
            else -> if (startedAt > 0L) builder
                .setUsesChronometer(true)
                .setChronometerCountDown(false)
                .setWhen(startedAt)
        }

        when (phase) {
            "resting" -> {
                builder.addAction(notifAction("minus-15", "−15s"))
                builder.addAction(notifAction("skip",     "Skip rest"))
                builder.addAction(notifAction("plus-15",  "+15s"))
            }
            "rest-done" -> {
                builder.addAction(notifAction("logged", "Logged it"))
                builder.addAction(notifAction("finish", "Finish"))
            }
            "complete" -> builder.addAction(notifAction("finish", "Finish"))
            else -> builder.addAction(notifAction("finish", "Finish workout"))
        }

        if (Build.VERSION.SDK_INT >= 36) {
            builder.setCategory("live_update")
        } else {
            builder.setCategory(NotificationCompat.CATEGORY_PROGRESS)
        }

        return builder.build()
    }

    private fun notifAction(actionKey: String, label: String): NotificationCompat.Action {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(MainActivity.EXTRA_NOTIF_ACTION, actionKey)
        }
        val pi = PendingIntent.getActivity(
            context, actionKey.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Action.Builder(0, label, pi).build()
    }

    private fun postFallbackNotification(snap: JSONObject) {
        runCatching {
            NotificationManagerCompat.from(context).notify(NOTIF_ID, buildNotification(snap))
        }.onFailure { err ->
            Log.w(TAG, "Fallback notification failed", err)
        }
    }

    private fun decodeDataUrl(dataUrl: String): ByteArray {
        val payload = dataUrl.substringAfter(",", dataUrl).trim()
        return Base64.decode(payload, Base64.DEFAULT)
    }

    private fun cleanFilename(filename: String, fallback: String, extension: String): String {
        val cleaned = filename
            .replace(Regex("""[\\/:*?"<>|]"""), "_")
            .trim()
            .take(96)
        return when {
            cleaned.isEmpty() -> fallback
            cleaned.endsWith(extension, ignoreCase = true) -> cleaned
            else -> "$cleaned$extension"
        }
    }

    private fun shareCacheFile(
        safeName: String,
        bytes: ByteArray,
        mimeType: String,
        title: String,
    ): Boolean {
        return try {
            val dir = File(context.cacheDir, "shared").apply { mkdirs() }
            val file = File(dir, safeName)
            file.writeBytes(bytes)
            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file,
            )
            val sendIntent = Intent(Intent.ACTION_SEND).apply {
                type = mimeType
                putExtra(Intent.EXTRA_TITLE, title)
                putExtra(Intent.EXTRA_SUBJECT, title)
                putExtra(Intent.EXTRA_STREAM, uri)
                clipData = ClipData.newUri(context.contentResolver, title, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            launchShare(sendIntent, title)
        } catch (e: Exception) {
            showToast("Share failed: ${e.message}", long = true)
            false
        }
    }

    private fun launchShare(sendIntent: Intent, title: String): Boolean {
        val chooser = Intent.createChooser(sendIntent, title.ifBlank { "Share with" }).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        Handler(Looper.getMainLooper()).post {
            try {
                context.startActivity(chooser)
            } catch (e: Exception) {
                showToast("Share failed: ${e.message}", long = true)
            }
        }
        return true
    }

    private fun showToast(message: String, long: Boolean = false) {
        (context as? Activity)?.runOnUiThread {
            Toast.makeText(context, message, if (long) Toast.LENGTH_LONG else Toast.LENGTH_SHORT).show()
        }
    }

    private fun parseHapticPattern(patternJson: String): LongArray {
        return runCatching {
            val trimmed = patternJson.trim()
            val values = if (trimmed.startsWith("[")) {
                val array = JSONArray(trimmed)
                (0 until array.length()).map { array.optLong(it, 18L) }
            } else {
                listOf(trimmed.toLongOrNull() ?: 18L)
            }
            values
                .filter { it > 0L }
                .map { it.coerceIn(1L, 400L) }
                .ifEmpty { listOf(18L) }
                .toLongArray()
        }.getOrDefault(longArrayOf(18L))
    }

    private fun getVibrator(): Vibrator? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.getSystemService(VibratorManager::class.java)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    // ── Channel (idempotent — safe to call on every bridge construction) ──────

    private fun createChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID, "Active Workout", NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Shows current exercise, set, and rest timer while a workout is running"
            lightColor = Color.parseColor("#E63B5D")
            enableLights(true)
            setShowBadge(false)
        }
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .createNotificationChannel(channel)
    }
}
