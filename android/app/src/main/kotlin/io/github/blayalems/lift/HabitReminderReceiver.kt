package io.github.blayalems.lift

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * Broadcast receiver for scheduled anti-hiatus training nudges and comeback pledge reminders.
 * Scheduled via AlarmManager.setAndAllowWhileIdle (no SCHEDULE_EXACT_ALARM required).
 */
class HabitReminderReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_HABIT_REMINDER = "io.github.blayalems.lift.HABIT_REMINDER"
        const val CHANNEL_ID = "lift_reminders"
        const val NOTIF_ID = 43
        const val REQUEST_CODE = 1043
        const val EXTRA_TITLE = "reminder_title"
        const val EXTRA_BODY = "reminder_body"

        private const val TAG = "HabitReminderReceiver"
        private const val LIFT_PINK = 0xFFE63B5D.toInt()
        private const val DEFAULT_TITLE = "Keep your Lift streak alive"
        private const val DEFAULT_BODY = "Even a 10-minute express session protects your momentum."

        fun createChannel(context: Context) {
            val nm = context.getSystemService(NotificationManager::class.java) ?: return
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Habit & Training Reminders",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Anti-hiatus training nudges and comeback pledge reminders"
                lightColor = LIFT_PINK
                enableLights(true)
                setShowBadge(true)
            }
            nm.createNotificationChannel(channel)
        }

        fun buildPendingIntent(context: Context, title: String, body: String): PendingIntent {
            val intent = Intent(context, HabitReminderReceiver::class.java).apply {
                action = ACTION_HABIT_REMINDER
                putExtra(EXTRA_TITLE, title)
                putExtra(EXTRA_BODY, body)
            }
            return PendingIntent.getBroadcast(
                context,
                REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        fun buildExistingPendingIntent(context: Context): PendingIntent? {
            val intent = Intent(context, HabitReminderReceiver::class.java).apply {
                action = ACTION_HABIT_REMINDER
            }
            return PendingIntent.getBroadcast(
                context,
                REQUEST_CODE,
                intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
        }
    }

    override fun onReceive(context: Context, intent: Intent?) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        createChannel(context)

        val title = intent?.getStringExtra(EXTRA_TITLE)?.trim().orEmpty().ifEmpty { DEFAULT_TITLE }
        val body = intent?.getStringExtra(EXTRA_BODY)?.trim().orEmpty().ifEmpty { DEFAULT_BODY }

        val openPi = PendingIntent.getActivity(
            context,
            REQUEST_CODE,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_dumbbell)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setColor(LIFT_PINK)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(openPi)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(NOTIF_ID, notification)
        } catch (err: SecurityException) {
            Log.w(TAG, "Reminder notification permission missing", err)
        } catch (err: Exception) {
            Log.w(TAG, "Failed to post habit reminder notification", err)
        }
    }
}
