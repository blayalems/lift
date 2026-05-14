package io.github.blayalems.lift

import android.app.*
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import org.json.JSONObject

/**
 * Foreground service that owns the Live Update notification while a workout is running.
 *
 * On Android 16 (API 36) the notification uses CATEGORY_LIVE_UPDATE so Android
 * renders it as a progress-centric card with a coloured status-bar chip.
 * On older Android it appears as a colourised foreground-service notification.
 */
class WorkoutService : Service() {

    companion object {
        const val ACTION_UPDATE = "io.github.blayalems.lift.UPDATE"
        const val ACTION_CLEAR  = "io.github.blayalems.lift.CLEAR"
        const val EXTRA_SNAP    = "snap"
        const val CHANNEL_ID    = "lift_workout"
        const val NOTIF_ID      = 42
        private const val LIFT_PINK = 0xFFE63B5D.toInt()
    }

    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_UPDATE -> {
                val json = intent.getStringExtra(EXTRA_SNAP) ?: return START_NOT_STICKY
                val snap = runCatching { JSONObject(json) }.getOrNull()
                    ?: return START_NOT_STICKY

                if (snap.optString("phase") == "idle") {
                    stopSelf()
                    return START_NOT_STICKY
                }

                val notification = buildNotification(snap)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                    startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_ACTIVE_PROCESSING)
                } else {
                    startForeground(NOTIF_ID, notification)
                }
            }
            ACTION_CLEAR -> stopSelf()
        }
        return START_NOT_STICKY
    }

    // ── Notification builder ──────────────────────────────────────────────────

    private fun buildNotification(snap: JSONObject): Notification {
        val phase          = snap.optString("phase", "set-up-next")
        val dayTitle       = snap.optString("dayTitle", "Workout")
        val exName         = snap.optString("exName", "")
        val setIndex       = snap.optInt("setIndex", 1)
        val totalSets      = snap.optInt("totalSets", 1)
        val curEx          = snap.optInt("currentExercise", 1)
        val totEx          = snap.optInt("totalExercises", 1)
        val weightText     = snap.optString("weightText", "")
        val repsText       = snap.optString("repsText", "")
        val unitLabel      = snap.optString("unitLabel", "kg")
        val restRemaining  = snap.optLong("restRemainingSec", 0L)
        val elapsedMin     = snap.optInt("elapsedMin", 0)
        val startedAt      = snap.optLong("startedAt", 0L)

        val exProgress = "Ex $curEx/$totEx"
        val setDetail  = if (weightText.isNotEmpty() && repsText.isNotEmpty())
            "$weightText $unitLabel × $repsText" else ""

        val (title, body) = when (phase) {
            "resting" -> {
                val m = restRemaining / 60
                val s = restRemaining % 60
                "Resting — %d:%02d".format(m, s) to
                    "$exProgress · $exName · Set $setIndex/$totalSets · $setDetail".trim(' ', '·')
            }
            "rest-done" ->
                "Rest done ✓" to
                    "$exProgress · $exName · Set $setIndex/$totalSets · $setDetail — ready!".trim(' ', '·')
            else ->
                dayTitle to
                    "$exProgress · ${exName.ifEmpty { "Workout running" }} · ${elapsedMin} min"
        }

        val openPi = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
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

        // Chronometer: count down rest timer, or count up workout elapsed time
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

        // Action buttons
        when (phase) {
            "resting" -> {
                builder.addAction(action("minus-15", "−15s"))
                builder.addAction(action("skip",     "Skip rest"))
                builder.addAction(action("plus-15",  "+15s"))
            }
            "rest-done" -> {
                builder.addAction(action("logged", "Logged it"))
                builder.addAction(action("finish", "Finish"))
            }
            else -> builder.addAction(action("finish", "Finish workout"))
        }

        // Android 16 Live Update category — produces the coloured status-bar chip
        if (Build.VERSION.SDK_INT >= 36) {
            builder.setCategory("live_update")
        } else {
            builder.setCategory(NotificationCompat.CATEGORY_PROGRESS)
        }

        return builder.build()
    }

    private fun action(actionKey: String, label: String): NotificationCompat.Action {
        val intent = Intent(this, NotificationActionReceiver::class.java).apply {
            action = "io.github.blayalems.lift.NOTIF_ACTION"
            putExtra(NotificationActionReceiver.EXTRA_ACTION, actionKey)
        }
        val pi = PendingIntent.getBroadcast(
            this, actionKey.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Action.Builder(0, label, pi).build()
    }

    // ── Channel ───────────────────────────────────────────────────────────────

    private fun createChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.notif_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = getString(R.string.notif_channel_desc)
            lightColor = Color.parseColor("#E63B5D")
            enableLights(true)
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
