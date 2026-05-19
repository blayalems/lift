package io.github.blayalems.lift

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.appwidget.AppWidgetProviderInfo
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

class LiftWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        val snap = loadSnap(context)
        updateGeneratedPreview(context, manager)
        appWidgetIds.forEach { id ->
            manager.updateAppWidget(id, views(context, snap))
        }
    }

    companion object {
        private const val PREFS_NAME = "lift_widget"
        private const val PREFS_KEY_SNAP = "snap"
        private const val PREFS_KEY_SIGNATURE = "signature"
        private const val PREFS_KEY_LAST_UPDATE_MS = "last_update_ms"
        private const val MIN_WIDGET_UPDATE_MS = 30_000L

        fun updateFromWorkoutState(context: Context, snap: JSONObject?) {
            if (snap == null || snap.optString("phase") == "idle") {
                updateAll(context, null)
                return
            }

            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val nextSignature = widgetSignature(snap)
            val previousSignature = prefs.getString(PREFS_KEY_SIGNATURE, "")
            val now = System.currentTimeMillis()
            val lastUpdate = prefs.getLong(PREFS_KEY_LAST_UPDATE_MS, 0L)
            if (nextSignature == previousSignature && now - lastUpdate < MIN_WIDGET_UPDATE_MS) {
                return
            }

            updateAll(context, snap, nextSignature, now)
        }

        fun updateAll(context: Context, snap: JSONObject?) {
            updateAll(context, snap, snap?.let { widgetSignature(it) }, System.currentTimeMillis())
        }

        private fun updateAll(context: Context, snap: JSONObject?, signature: String?, updateTimeMs: Long) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .apply {
                    if (snap == null) {
                        remove(PREFS_KEY_SNAP)
                        remove(PREFS_KEY_SIGNATURE)
                        remove(PREFS_KEY_LAST_UPDATE_MS)
                    } else {
                        putString(PREFS_KEY_SNAP, snap.toString())
                        putString(PREFS_KEY_SIGNATURE, signature ?: widgetSignature(snap))
                        putLong(PREFS_KEY_LAST_UPDATE_MS, updateTimeMs)
                    }
                }
                .apply()
            val manager = context.getSystemService(AppWidgetManager::class.java) ?: return
            updateGeneratedPreview(context, manager)
            val ids = manager.getAppWidgetIds(ComponentName(context, LiftWidgetProvider::class.java))
            if (ids.isEmpty()) return
            val remoteViews = views(context, snap)
            ids.forEach { id -> manager.updateAppWidget(id, remoteViews) }
        }

        private fun updateGeneratedPreview(context: Context, manager: AppWidgetManager) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return
            runCatching {
                manager.setWidgetPreview(
                    ComponentName(context, LiftWidgetProvider::class.java),
                    AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN,
                    views(context, null),
                )
            }
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
            val isResting = phase == "resting" && restRemaining > 0L

            val status = when (phase) {
                "resting" -> "Rest"
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
                setViewVisibility(R.id.widget_status, if (isResting) View.GONE else View.VISIBLE)
                setViewVisibility(R.id.widget_chronometer, if (isResting) View.VISIBLE else View.GONE)
                if (isResting) {
                    setChronometer(
                        R.id.widget_chronometer,
                        SystemClock.elapsedRealtime() + restRemaining * 1000L,
                        "Rest %s",
                        true,
                    )
                    setChronometerCountDown(R.id.widget_chronometer, true)
                }
            }
        }

        private fun widgetSignature(snap: JSONObject): String = listOf(
            snap.optString("phase", "idle"),
            snap.optString("dayTitle", ""),
            snap.optString("exName", ""),
            snap.optInt("currentExercise", 0).toString(),
            snap.optInt("setIndex", 0).toString(),
            snap.optInt("totalSets", 0).toString(),
        ).joinToString("|")

        private fun loadSnap(context: Context): JSONObject? {
            val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getString(PREFS_KEY_SNAP, null)
            return raw?.let { runCatching { JSONObject(it) }.getOrNull() }
        }
    }
}
