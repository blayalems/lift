package io.github.blayalems.lift

import android.Manifest
import android.app.*
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
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
                    NotificationManagerCompat.from(context).notify(NOTIF_ID, buildNotification(snap))
                }
            }
        } else {
            NotificationManagerCompat.from(context).notify(NOTIF_ID, buildNotification(snap))
        }
    }

    @JavascriptInterface
    fun clearWorkout() {
        Handler(Looper.getMainLooper()).post {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                runCatching { context.stopService(Intent(context, WorkoutService::class.java)) }
                runCatching { NotificationManagerCompat.from(context).cancel(NOTIF_ID) }
            }
            NotificationManagerCompat.from(context).cancel(NOTIF_ID)
        }
    }

    @JavascriptInterface
    fun isNative(): Boolean = true

    @JavascriptInterface
    fun saveBackupFile(filename: String, json: String) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, filename)
                    put(MediaStore.Downloads.MIME_TYPE, "application/json")
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val resolver = context.contentResolver
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: throw Exception("MediaStore insert returned null")
                resolver.openOutputStream(uri)?.use { it.write(json.toByteArray(Charsets.UTF_8)) }
                values.clear()
                values.put(MediaStore.Downloads.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
            } else {
                val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                dir.mkdirs()
                File(dir, filename).writeText(json, Charsets.UTF_8)
            }
            (context as? Activity)?.runOnUiThread {
                Toast.makeText(context, "Backup saved to Downloads/$filename", Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            (context as? Activity)?.runOnUiThread {
                Toast.makeText(context, "Backup save failed: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    // ── Notification builder ──────────────────────────────────────────────────

    private fun buildNotification(snap: JSONObject): Notification {
        if (Build.VERSION.SDK_INT >= 36) {
            return buildProgressStyleNotification(context, snap, CHANNEL_ID)
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
        val intent = Intent(context, NotificationActionReceiver::class.java).apply {
            action = "io.github.blayalems.lift.NOTIF_ACTION"
            putExtra(NotificationActionReceiver.EXTRA_ACTION, actionKey)
        }
        val pi = PendingIntent.getBroadcast(
            context, actionKey.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Action.Builder(0, label, pi).build()
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
