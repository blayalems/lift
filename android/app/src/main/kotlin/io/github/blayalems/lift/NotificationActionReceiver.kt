package io.github.blayalems.lift

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Receives taps on Live Update notification action buttons
 * (-15s, Skip rest, +15s, Logged it, Finish) and forwards the action
 * back to the PWA via MainActivity.
 */
class NotificationActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.getStringExtra(EXTRA_ACTION) ?: return

        // Dismiss the notification if the user finishes
        if (action == "finish") {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.cancel(WorkoutService.NOTIF_ID)
            context.startService(
                Intent(context, WorkoutService::class.java).apply {
                    this.action = WorkoutService.ACTION_CLEAR
                }
            )
        }

        // Bring MainActivity to front and deliver the action
        val launch = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
            putExtra(MainActivity.EXTRA_NOTIF_ACTION, action)
        }
        context.startActivity(launch)
    }

    companion object {
        const val EXTRA_ACTION = "notif_action"
    }
}
