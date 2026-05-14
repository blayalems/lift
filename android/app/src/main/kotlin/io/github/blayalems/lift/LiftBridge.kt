package io.github.blayalems.lift

import android.Manifest
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.webkit.JavascriptInterface
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject

/**
 * Exposed to the PWA as `window.LiftAndroid`.
 *
 * Notification is posted directly via NotificationManagerCompat — no
 * foreground service, no startForeground() — removing the entire class of
 * InvalidForegroundServiceTypeException / SecurityException crashes that
 * the foreground-service path was susceptible to.
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
        NotificationManagerCompat.from(context).notify(NOTIF_ID, buildNotification(snap))
    }

    @JavascriptInterface
    fun clearWorkout() {
        NotificationManagerCompat.from(context).cancel(NOTIF_ID)
    }

    @JavascriptInterface
    fun isNative(): Boolean = true

    // ── Notification builder ──────────────────────────────────────────────────

    private fun buildNotification(snap: JSONObject): Notification {
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
