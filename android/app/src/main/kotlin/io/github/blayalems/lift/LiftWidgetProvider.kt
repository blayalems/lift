package io.github.blayalems.lift

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import org.json.JSONObject

class LiftWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        val snap = loadSnap(context)
        appWidgetIds.forEach { id ->
            manager.updateAppWidget(id, views(context, snap))
        }
    }

    companion object {
        private const val PREFS_NAME = "lift_widget"
        private const val PREFS_KEY_SNAP = "snap"

        fun updateAll(context: Context, snap: JSONObject?) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .apply {
                    if (snap == null) remove(PREFS_KEY_SNAP) else putString(PREFS_KEY_SNAP, snap.toString())
                }
                .apply()
            val manager = context.getSystemService(AppWidgetManager::class.java) ?: return
            val ids = manager.getAppWidgetIds(ComponentName(context, LiftWidgetProvider::class.java))
            if (ids.isEmpty()) return
            val remoteViews = views(context, snap)
            ids.forEach { id -> manager.updateAppWidget(id, remoteViews) }
        }

        private fun views(context: Context, snap: JSONObject?): RemoteViews {
            val phase = snap?.optString("phase", "idle") ?: "idle"
            val dayTitle = snap?.optString("dayTitle", "Lift") ?: "Lift"
            val exName = snap?.optString("exName", "") ?: ""
            val currentExercise = snap?.optInt("currentExercise", 0) ?: 0
            val totalExercises = snap?.optInt("totalExercises", 0) ?: 0
            val setIndex = snap?.optInt("setIndex", 0) ?: 0
            val totalSets = snap?.optInt("totalSets", 0) ?: 0
            val restRemaining = snap?.optLong("restRemainingSec", 0L) ?: 0L

            val status = when (phase) {
                "resting" -> "Rest ${formatRest(restRemaining)}"
                "rest-done" -> "Rest done"
                "complete" -> "Workout complete"
                "idle" -> "Ready to train"
                else -> if (currentExercise > 0 && totalExercises > 0) {
                    "Exercise $currentExercise/$totalExercises"
                } else {
                    "Workout active"
                }
            }

            val detail = when {
                phase == "idle" -> "Tap to open today's workout"
                exName.isNotBlank() && totalSets > 0 -> "$exName - Set $setIndex/$totalSets"
                exName.isNotBlank() -> exName
                else -> dayTitle
            }

            val openIntent = PendingIntent.getActivity(
                context,
                0,
                Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            return RemoteViews(context.packageName, R.layout.lift_widget).apply {
                setTextViewText(R.id.widget_title, dayTitle)
                setTextViewText(R.id.widget_status, status)
                setTextViewText(R.id.widget_detail, detail)
                setOnClickPendingIntent(R.id.widget_root, openIntent)
            }
        }

        private fun formatRest(seconds: Long): String {
            val clamped = seconds.coerceAtLeast(0L)
            return "%d:%02d".format(clamped / 60, clamped % 60)
        }

        private fun loadSnap(context: Context): JSONObject? {
            val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getString(PREFS_KEY_SNAP, null)
            return raw?.let { runCatching { JSONObject(it) }.getOrNull() }
        }
    }
}
