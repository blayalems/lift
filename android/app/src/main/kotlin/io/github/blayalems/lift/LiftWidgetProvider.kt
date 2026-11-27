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
        val snap = loadActiveSnap(context)
        val engagement = loadEngagement(context)
        updateGeneratedPreview(context, manager, engagement)
        val remoteViews = views(context, snap, engagement)
        appWidgetIds.forEach { id ->
            manager.updateAppWidget(id, remoteViews)
        }
    }

    companion object {
        private const val PREFS_NAME = "lift_widget"
        private const val PREFS_KEY_SNAP = "snap"
        private const val PREFS_KEY_SIGNATURE = "signature"
        private const val PREFS_KEY_LAST_UPDATE_MS = "last_update_ms"
        private const val PREFS_KEY_ENGAGEMENT = "engagement"
        private const val PREFS_KEY_PREVIEW_MS = "last_preview_ms"
        private const val MIN_WIDGET_UPDATE_MS = 30_000L
        private const val MIN_PREVIEW_INTERVAL_MS = 35L * 60L * 1000L

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

        fun updateEngagement(context: Context, payload: JSONObject?) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .apply {
                    if (payload == null) {
                        remove(PREFS_KEY_ENGAGEMENT)
                    } else {
                        putString(PREFS_KEY_ENGAGEMENT, payload.toString())
                    }
                }
                .apply()
            val manager = context.getSystemService(AppWidgetManager::class.java) ?: return
            updateGeneratedPreview(context, manager, payload)
            val ids = manager.getAppWidgetIds(ComponentName(context, LiftWidgetProvider::class.java))
            if (ids.isEmpty()) return
            val remoteViews = views(context, loadActiveSnap(context), payload)
            ids.forEach { id -> manager.updateAppWidget(id, remoteViews) }
        }

        private fun updateAll(context: Context, snap: JSONObject?, signature: String?, updateTimeMs: Long) {
            val activeSnap = snap?.takeIf { it.optString("phase", "idle") != "idle" }
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .apply {
                    if (activeSnap == null) {
                        remove(PREFS_KEY_SNAP)
                        remove(PREFS_KEY_SIGNATURE)
                        remove(PREFS_KEY_LAST_UPDATE_MS)
                    } else {
                        putString(PREFS_KEY_SNAP, activeSnap.toString())
                        putString(PREFS_KEY_SIGNATURE, signature ?: widgetSignature(activeSnap))
                        putLong(PREFS_KEY_LAST_UPDATE_MS, updateTimeMs)
                    }
                }
                .apply()
            val manager = context.getSystemService(AppWidgetManager::class.java) ?: return
            val engagement = loadEngagement(context)
            updateGeneratedPreview(context, manager, engagement)
            val ids = manager.getAppWidgetIds(ComponentName(context, LiftWidgetProvider::class.java))
            if (ids.isEmpty()) return
            val remoteViews = views(context, activeSnap, engagement)
            ids.forEach { id -> manager.updateAppWidget(id, remoteViews) }
        }

        private fun updateGeneratedPreview(
            context: Context,
            manager: AppWidgetManager,
            engagement: JSONObject? = loadEngagement(context),
        ) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val now = System.currentTimeMillis()
            val lastPreview = prefs.getLong(PREFS_KEY_PREVIEW_MS, 0L)
            if (lastPreview > 0L && now - lastPreview < MIN_PREVIEW_INTERVAL_MS) return

            val previewViews = views(context, null, engagement)
            val provider = ComponentName(context, LiftWidgetProvider::class.java)
            val homeOk = runCatching {
                manager.setWidgetPreview(
                    provider,
                    AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN,
                    previewViews,
                )
            }.isSuccess
            val keyguardOk = runCatching {
                manager.setWidgetPreview(
                    provider,
                    AppWidgetProviderInfo.WIDGET_CATEGORY_KEYGUARD,
                    previewViews,
                )
            }.isSuccess
            if (homeOk || keyguardOk) {
                prefs.edit().putLong(PREFS_KEY_PREVIEW_MS, now).apply()
            }
        }

        private fun views(
            context: Context,
            snap: JSONObject?,
            engagement: JSONObject? = loadEngagement(context),
        ): RemoteViews {
            val phase = snap?.optString("phase", "idle") ?: "idle"
            val isActiveWorkout = snap != null && phase != "idle"
            val dayTitle = snap?.optString("dayTitle", "Lift")?.ifBlank { "Lift" } ?: "Lift"
            val exName = snap?.optString("exName", "") ?: ""
            val currentExercise = snap?.optInt("currentExercise", 0) ?: 0
            val totalExercises = snap?.optInt("totalExercises", 0) ?: 0
            val setIndex = snap?.optInt("setIndex", 0) ?: 0
            val totalSets = snap?.optInt("totalSets", 0) ?: 0
            val restRemaining = snap?.optLong("restRemainingSec", 0L) ?: 0L
            val quote = snap?.optString("quote", "") ?: ""
            val isResting = phase == "resting" && restRemaining > 0L

            val streak = engagement?.let {
                if (it.has("streak")) it.optInt("streak", 0) else it.optInt("streakDays", 0)
            } ?: 0
            val level = engagement?.optInt("level", 0) ?: 0
            val rankTitle = engagement?.optString("title", "") ?: ""
            val shields = engagement?.optInt("shields", 0) ?: 0
            val hiatusTier = engagement?.optString("hiatusTier", "") ?: ""
            val gapDays = engagement?.optInt("gapDays", -1) ?: -1
            val pledgeText = engagement?.optString("pledgeText", "") ?: ""
            val nextQuest = engagement?.optString("nextQuest", "") ?: ""
            val cue = engagement?.optString("cue", "") ?: ""

            val eyebrow = when {
                isActiveWorkout -> dayTitle
                rankTitle.isNotBlank() -> "Lift · $rankTitle"
                else -> context.getString(R.string.app_name)
            }

            val chipText = when {
                streak > 0 && level > 0 -> "${streak}d Streak · Lv $level"
                streak > 0 -> "${streak}d Streak"
                level > 0 && shields > 0 -> "Lv $level · ${shields}S"
                level > 0 -> "Lv $level"
                isActiveWorkout && currentExercise > 0 && totalExercises > 0 -> "Ex $currentExercise/$totalExercises"
                else -> context.getString(R.string.widget_chip_default)
            }

            val status = when (phase) {
                "resting" -> "Rest"
                "rest-done" -> "Rest done"
                "complete" -> "Workout complete"
                "idle" -> when (hiatusTier) {
                    "rescue", "reentry" -> "10-min reset ready"
                    "warning" -> "Keep the chain"
                    "watch" -> "Lock today's lift"
                    else -> context.getString(R.string.widget_ready)
                }
                else -> if (currentExercise > 0 && totalExercises > 0) {
                    "Exercise $currentExercise/$totalExercises"
                } else {
                    "Workout active"
                }
            }

            val detail = when {
                isActiveWorkout -> {
                    val base = when {
                        exName.isNotBlank() && totalSets > 0 -> "$exName · Set $setIndex/$totalSets"
                        exName.isNotBlank() -> exName
                        else -> dayTitle
                    }
                    when {
                        phase == "complete" && quote.isNotBlank() -> quote
                        isResting && quote.isNotBlank() -> "$base\n$quote"
                        else -> base
                    }
                }
                cue.isNotBlank() -> cue
                pledgeText.isNotBlank() -> pledgeText
                gapDays >= 7 -> "1 light session resets your chain (${gapDays}d gap)"
                gapDays in 2..6 -> "Protect the groove · ${gapDays}d since last lift"
                nextQuest.isNotBlank() -> nextQuest
                else -> context.getString(R.string.widget_detail_idle)
            }

            val openIntent = PendingIntent.getActivity(
                context,
                0,
                Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            val ctaLabel = when {
                isResting -> context.getString(R.string.widget_cta_skip)
                isActiveWorkout -> context.getString(R.string.widget_cta_open)
                else -> context.getString(R.string.widget_cta_start)
            }

            val ctaIntent = if (isResting) {
                PendingIntent.getActivity(
                    context,
                    "skip".hashCode(),
                    Intent(context, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                        putExtra(MainActivity.EXTRA_NOTIF_ACTION, "skip")
                    },
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
            } else {
                openIntent
            }

            return RemoteViews(context.packageName, R.layout.lift_widget).apply {
                setTextViewText(R.id.widget_title, eyebrow)
                setTextViewText(R.id.widget_chip, chipText)
                setTextViewText(R.id.widget_status, status)
                setTextViewText(R.id.widget_detail, detail)
                setTextViewText(R.id.widget_cta, ctaLabel)
                setContentDescription(R.id.widget_cta, ctaLabel)
                setOnClickPendingIntent(R.id.widget_root, openIntent)
                setOnClickPendingIntent(R.id.widget_cta, ctaIntent)
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

        private fun widgetSignature(snap: JSONObject): String {
            val phase = snap.optString("phase", "idle")
            val restEndToken = if (phase == "resting" && snap.optLong("restRemainingSec", 0L) > 0L) {
                val endsAt = snap.optLong("restEndsAt", snap.optLong("restEndEpochMs", 0L))
                if (endsAt > 0L) endsAt.toString() else "resting"
            } else {
                "0"
            }
            return listOf(
                phase,
                snap.optString("dayTitle", ""),
                snap.optString("exName", ""),
                snap.optInt("currentExercise", 0).toString(),
                snap.optInt("setIndex", 0).toString(),
                snap.optInt("totalSets", 0).toString(),
                snap.optString("quote", ""),
                restEndToken,
            ).joinToString("|")
        }

        private fun loadActiveSnap(context: Context): JSONObject? {
            val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getString(PREFS_KEY_SNAP, null)
            return raw?.let { runCatching { JSONObject(it) }.getOrNull() }
                ?.takeIf { it.optString("phase", "idle") != "idle" }
        }

        private fun loadEngagement(context: Context): JSONObject? {
            val raw = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getString(PREFS_KEY_ENGAGEMENT, null)
            return raw?.let { runCatching { JSONObject(it) }.getOrNull() }
        }
    }
}
