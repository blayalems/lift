package io.github.blayalems.lift

import android.Manifest
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject

/**
 * Foreground service that owns the Live Update notification while a workout is running.
 *
 * On Android 16/17 (API 36+) the notification uses ProgressStyle + CATEGORY_LIVE_UPDATE
 * so Android renders it as a progress-centric card with a phase-aware status-bar chip.
 * On older Android it appears as a colourised foreground-service notification.
 */
class WorkoutService : Service() {
    private val tag = "WorkoutService"
    private var loggedPromotionDiag = false

    companion object {
        const val ACTION_UPDATE = "io.github.blayalems.lift.UPDATE"
        const val ACTION_CLEAR  = "io.github.blayalems.lift.CLEAR"
        const val EXTRA_SNAP    = "snap"
        const val CHANNEL_ID    = "lift_workout"
        const val NOTIF_ID      = 42
    }

    override fun onCreate() {
        super.onCreate()
        ensureWorkoutChannel(this, CHANNEL_ID)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_UPDATE -> {
                val json = intent.getStringExtra(EXTRA_SNAP) ?: return START_NOT_STICKY
                val snap = runCatching { JSONObject(json) }.getOrNull()
                    ?: return START_NOT_STICKY

                if (snap.optString("phase") == "idle") {
                    LiftWidgetProvider.updateAll(this, null)
                    stopForegroundNotification()
                    stopSelf()
                    return START_NOT_STICKY
                }

                if (Build.VERSION.SDK_INT >= 36 && !loggedPromotionDiag) {
                    loggedPromotionDiag = true
                    val promoted = canPostPromotedNotifications(this)
                    if (!promoted) {
                        Log.i(tag, "Promoted Live Updates not granted; posting standard workout notification")
                    }
                }

                LiftWidgetProvider.updateFromWorkoutState(this, snap)
                val notification = buildWorkoutNotification(this, snap, CHANNEL_ID)
                // FOREGROUND_SERVICE_TYPE_HEALTH requires the 3-arg form on API 34+.
                // Guard startForeground so any platform/runtime restriction can't crash the app.
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                        startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH)
                    } else {
                        startForeground(NOTIF_ID, notification)
                    }
                } catch (e: Exception) {
                    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                        ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
                        PackageManager.PERMISSION_GRANTED
                    ) {
                        try {
                            NotificationManagerCompat.from(this).notify(NOTIF_ID, notification)
                        } catch (err: SecurityException) {
                            Log.w(tag, "Fallback notification permission changed", err)
                        } catch (err: Exception) {
                            Log.w(tag, "Fallback notification failed", err)
                        }
                    }
                    stopSelf()
                    return START_NOT_STICKY
                }
            }
            ACTION_CLEAR -> {
                LiftWidgetProvider.updateAll(this, null)
                stopForegroundNotification()
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun stopForegroundNotification() {
        runCatching { stopForeground(STOP_FOREGROUND_REMOVE) }
        runCatching { NotificationManagerCompat.from(this).cancel(NOTIF_ID) }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
