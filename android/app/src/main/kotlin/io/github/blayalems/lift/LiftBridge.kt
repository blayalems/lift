package io.github.blayalems.lift

import android.Manifest
import android.app.Activity
import android.app.AlarmManager
import android.content.ClipData
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.MediaStore
import android.provider.Settings
import android.util.AtomicFile
import android.util.Base64
import android.util.Log
import android.view.HapticFeedbackConstants
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

/**
 * Exposed to the PWA as `window.LiftAndroid`.
 *
 * On API 35+ (Android 15+), workout state is routed through WorkoutService so the
 * notification runs under a foreground service — required for Android 16/17 Live Update
 * status-bar chips. On API 26-34 notifications are posted directly via
 * NotificationManagerCompat, keeping all foreground-service crash vectors off those devices.
 */
class LiftBridge(private val context: Context) {

    companion object {
        const val NOTIF_ID   = 42
        const val CHANNEL_ID = "lift_workout"
        private const val TAG = "LiftBridge"
        private const val HAPTIC_FALLBACK_MIN_MS = 60L
        private const val STATE_MIRROR_FILE = "lift_state.json"
        private const val MAX_STATE_MIRROR_BYTES = 20 * 1024 * 1024
        private const val MAX_REMINDER_MINUTES = 60 * 24 * 30
    }

    init {
        ensureWorkoutChannel(context, CHANNEL_ID)
        HabitReminderReceiver.createChannel(context)
    }

    @Volatile private var lastFallbackHapticMs = 0L

    @JavascriptInterface
    fun onWorkoutState(json: String) {
        val snap = runCatching { JSONObject(json) }.getOrNull() ?: return
        if (snap.optString("phase") == "idle") {
            clearWorkout()
            return
        }
        LiftWidgetProvider.updateFromWorkoutState(context, snap)
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
            }
            runCatching { NotificationManagerCompat.from(context).cancel(NOTIF_ID) }
        }
    }

    @JavascriptInterface
    fun isNative(): Boolean = true

    @JavascriptInterface
    fun setSystemBars(theme: String) {
        Handler(Looper.getMainLooper()).post {
            (context as? MainActivity)?.applySystemBars(theme)
        }
    }

    @JavascriptInterface
    fun setBackConsumerActive(active: Boolean) {
        (context as? MainActivity)?.setBackConsumerActive(active)
    }

    @JavascriptInterface
    fun getAndroidInfo(): String = JSONObject().apply {
        val sdk = Build.VERSION.SDK_INT
        put("sdk", sdk)
        put("release", Build.VERSION.RELEASE ?: "")
        put("manufacturer", Build.MANUFACTURER ?: "")
        put("model", Build.MODEL ?: "")
        put("brand", Build.BRAND ?: "")
        put("isAndroid17", sdk >= 37)
        put("supportsLiveUpdates", sdk >= 36)
        put("supportsWidgetPreview", sdk >= Build.VERSION_CODES.VANILLA_ICE_CREAM)
        put("canPostPromotedNotifications", canPostPromotedNotifications(context))
        put("isLargeScreen", isLargeScreenDevice())
        put("notificationsEnabled", NotificationManagerCompat.from(context).areNotificationsEnabled())
    }.toString()

    @JavascriptInterface
    fun updateWidgetEngagement(json: String) {
        val trimmed = json.trim()
        if (trimmed.isEmpty() || trimmed == "null") {
            runCatching { LiftWidgetProvider.updateEngagement(context, null) }
                .onFailure { Log.w(TAG, "Widget engagement reset failed", it) }
            return
        }
        val snap = runCatching { JSONObject(trimmed) }.getOrNull() ?: return
        runCatching { LiftWidgetProvider.updateEngagement(context, snap) }
            .onFailure { Log.w(TAG, "Widget engagement update failed", it) }
    }

    @JavascriptInterface
    fun scheduleHabitReminder(delayMinutes: Int, title: String, body: String): Boolean {
        if (delayMinutes <= 0) return false
        val safeMinutes = delayMinutes.coerceAtMost(MAX_REMINDER_MINUTES)
        return runCatching {
            val alarmManager = context.getSystemService(AlarmManager::class.java) ?: return false
            val triggerAtMs = System.currentTimeMillis() + safeMinutes * 60_000L
            val pi = HabitReminderReceiver.buildPendingIntent(context, title, body)
            alarmManager.cancel(pi)
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi)
            true
        }.onFailure { Log.w(TAG, "Failed to schedule habit reminder", it) }
            .getOrDefault(false)
    }

    @JavascriptInterface
    fun cancelHabitReminder(): Boolean {
        return runCatching {
            val alarmManager = context.getSystemService(AlarmManager::class.java) ?: return false
            val pi = HabitReminderReceiver.buildExistingPendingIntent(context)
            if (pi != null) {
                alarmManager.cancel(pi)
                pi.cancel()
            }
            NotificationManagerCompat.from(context).cancel(HabitReminderReceiver.NOTIF_ID)
            true
        }.onFailure { Log.w(TAG, "Failed to cancel habit reminder", it) }
            .getOrDefault(false)
    }

    @JavascriptInterface
    fun openNotificationSettings(): Boolean {
        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
            putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
            if (context !is Activity) {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        }
        return try {
            Handler(Looper.getMainLooper()).post {
                runCatching { context.startActivity(intent) }
                    .onFailure { Log.w(TAG, "Failed to open notification settings", it) }
            }
            true
        } catch (e: Exception) {
            Log.w(TAG, "Failed to post notification settings intent", e)
            false
        }
    }

    /**
     * Keep the PWA's canonical state in app-private storage as a second durable
     * copy. The file is the only app file included in Android Auto Backup and
     * device transfer rules. JavascriptInterface calls already run off the UI
     * thread, so synchronous atomic I/O is appropriate here.
     */
    @JavascriptInterface
    fun saveStateMirror(json: String): Boolean {
        val bytes = json.toByteArray(Charsets.UTF_8)
        if (bytes.isEmpty() || bytes.size > MAX_STATE_MIRROR_BYTES) return false
        val valid = runCatching {
            val parsed = JSONObject(json)
            require(parsed.optJSONObject("days") != null) { "Missing days object" }
        }.isSuccess
        if (!valid) return false

        val atomic = AtomicFile(File(context.filesDir, STATE_MIRROR_FILE))
        var pending: FileOutputStream? = null
        return try {
            val stream = atomic.startWrite()
            pending = stream
            stream.write(bytes)
            stream.fd.sync()
            atomic.finishWrite(stream)
            pending = null
            true
        } catch (e: Exception) {
            pending?.let { runCatching { atomic.failWrite(it) } }
            Log.w(TAG, "State mirror write failed", e)
            false
        }
    }

    @JavascriptInterface
    fun loadStateMirror(): String {
        val file = File(context.filesDir, STATE_MIRROR_FILE)
        if (!file.isFile || file.length() <= 0L || file.length() > MAX_STATE_MIRROR_BYTES) return ""
        return runCatching {
            val json = file.readText(Charsets.UTF_8)
            val parsed = JSONObject(json)
            require(parsed.optJSONObject("days") != null) { "Missing days object" }
            json
        }.onFailure { Log.w(TAG, "State mirror read failed", it) }.getOrDefault("")
    }

    @JavascriptInterface
    fun clearStateMirror(): Boolean = runCatching {
        AtomicFile(File(context.filesDir, STATE_MIRROR_FILE)).delete()
        true
    }.onFailure { Log.w(TAG, "State mirror delete failed", it) }.getOrDefault(false)

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
                performFallbackHaptic(decor)
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
                performFallbackHaptic(decor)
                true
            }
        } catch (e: Exception) {
            performFallbackHaptic(decor)
            false
        }
    }

    private fun isLargeScreenDevice(): Boolean {
        val config = context.resources.configuration
        val screenSize = config.screenLayout and Configuration.SCREENLAYOUT_SIZE_MASK
        return config.smallestScreenWidthDp >= 600 ||
            screenSize == Configuration.SCREENLAYOUT_SIZE_LARGE ||
            screenSize == Configuration.SCREENLAYOUT_SIZE_XLARGE
    }

    private fun performFallbackHaptic(decor: android.view.View?) {
        val now = SystemClock.elapsedRealtime()
        if (now - lastFallbackHapticMs < HAPTIC_FALLBACK_MIN_MS) return
        lastFallbackHapticMs = now
        Handler(Looper.getMainLooper()).post {
            decor?.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
        }
    }

    private fun postFallbackNotification(snap: JSONObject) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) return
        try {
            NotificationManagerCompat.from(context)
                .notify(NOTIF_ID, buildWorkoutNotification(context, snap, CHANNEL_ID))
        } catch (err: SecurityException) {
            Log.w(TAG, "Fallback notification permission changed", err)
        } catch (err: Exception) {
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
}
