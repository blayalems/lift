package io.github.blayalems.lift

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.Icon
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.core.app.NotificationCompat
import org.json.JSONObject

/**
 * Android 16/17 (API 36+) progress-centric Live Update notification builder
 * plus compat fallback for API 26–35.
 *
 * Uses strict vector drawable icons (ic_dumbbell) with zero raster bitmaps,
 * phase-aware accent colors (active sets, rest countdown, rest-done emerald,
 * workout complete gold), optional motivational quote subtext, and reflection-
 * guarded canPostPromotedNotifications diagnostics.
 */
private const val LIFT_PINK         = 0xFFE63B5D.toInt()
private const val LIFT_PINK_FILLED  = 0xFFB12546.toInt()
private const val LIFT_REST_BLUE    = 0xFF3B82F6.toInt()
private const val LIFT_EMERALD      = 0xFF10B981.toInt()
private const val LIFT_GOLD         = 0xFFF59E0B.toInt()
private const val LIFT_TRACK_REMAIN = 0xFF888888.toInt()

// Platform key (Notification.EXTRA_REQUEST_PROMOTED_ONGOING — string literal kept
// for forward-compat across API 36/37 SDK revisions).
private const val EXTRA_REQUEST_PROMOTED_ONGOING = "android.requestPromotedOngoing"
private const val TAG = "WorkoutNotification"

private data class WorkoutNotifCopy(
    val phase: String,
    val title: String,
    val body: String,
    val chipText: String,
    val accentColor: Int,
    val quote: String,
    val curEx: Int,
    val totEx: Int,
    val setIndex: Int,
    val totalSets: Int,
    val restRemaining: Long,
    val startedAt: Long,
)

private fun JSONObject.optCleanString(key: String, fallback: String = ""): String =
    if (isNull(key)) fallback else optString(key, fallback)

internal fun canPostPromotedNotifications(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < 36) return false
    return runCatching {
        val nm = context.getSystemService(NotificationManager::class.java) ?: return false
        val method = NotificationManager::class.java.getMethod("canPostPromotedNotifications")
        (method.invoke(nm) as? Boolean) ?: false
    }.getOrDefault(false)
}

internal fun ensureWorkoutChannel(context: Context, channelId: String) {
    val nm = context.getSystemService(NotificationManager::class.java) ?: return
    val channel = NotificationChannel(
        channelId,
        context.getString(R.string.notif_channel_name),
        NotificationManager.IMPORTANCE_HIGH
    ).apply {
        description = context.getString(R.string.notif_channel_desc)
        lightColor = LIFT_PINK
        enableLights(true)
        setShowBadge(false)
    }
    nm.createNotificationChannel(channel)
}

internal fun buildWorkoutNotification(
    context: Context,
    snap: JSONObject,
    channelId: String,
): Notification {
    if (Build.VERSION.SDK_INT >= 36) {
        val progress = runCatching { buildProgressStyleNotification(context, snap, channelId) }
        progress.getOrNull()?.let { return it }
        progress.exceptionOrNull()?.let { err ->
            Log.w(TAG, "Progress-style notification failed; falling back to compat", err)
        }
    }
    return buildCompatWorkoutNotification(context, snap, channelId)
}

private fun parseWorkoutNotifCopy(snap: JSONObject): WorkoutNotifCopy {
    val phase         = snap.optCleanString("phase", "set-up-next")
    val dayTitle      = snap.optCleanString("dayTitle", "Workout").ifBlank { "Workout" }
    val exName        = snap.optCleanString("exName", "")
    val rawSetIndex   = snap.optInt("setIndex", 1)
    val totalSets     = snap.optInt("totalSets", 1).coerceAtLeast(1)
    val setIndex      = rawSetIndex.coerceIn(0, totalSets)
    val curEx         = snap.optInt("currentExercise", 1).coerceAtLeast(1)
    val totEx         = snap.optInt("totalExercises", 1).coerceAtLeast(1)
    val weightText    = snap.optCleanString("weightText", "")
    val repsText      = snap.optCleanString("repsText", "")
    val unitLabel     = snap.optCleanString("unitLabel", "kg").ifBlank { "kg" }
    val restRemaining = snap.optLong("restRemainingSec", 0L).coerceAtLeast(0L)
    val elapsedMin    = snap.optInt("elapsedMin", 0)
    val startedAt     = snap.optLong("startedAt", 0L)
    val quote         = snap.optCleanString("quote", "").trim().take(120)

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
        "complete" ->
            "Workout complete" to "$exProgress · Finish workout when ready"
        else ->
            dayTitle to
                "$exProgress · ${exName.ifEmpty { "Workout running" }} · $elapsedMin min"
    }

    val chipText = when (phase) {
        "resting" -> "%d:%02d".format(restRemaining / 60, restRemaining % 60)
        "rest-done" -> "Ready"
        "complete" -> "Done"
        else -> "Ex $curEx/$totEx"
    }

    val accentColor = when (phase) {
        "resting" -> LIFT_REST_BLUE
        "rest-done" -> LIFT_EMERALD
        "complete" -> LIFT_GOLD
        else -> LIFT_PINK
    }

    return WorkoutNotifCopy(
        phase = phase,
        title = title,
        body = body,
        chipText = chipText,
        accentColor = accentColor,
        quote = quote,
        curEx = curEx,
        totEx = totEx,
        setIndex = setIndex,
        totalSets = totalSets,
        restRemaining = restRemaining,
        startedAt = startedAt,
    )
}

@RequiresApi(36)
internal fun buildProgressStyleNotification(
    context: Context,
    snap: JSONObject,
    channelId: String,
): Notification {
    val copy = parseWorkoutNotifCopy(snap)

    val openPi = PendingIntent.getActivity(
        context, 0,
        Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val builder = Notification.Builder(context, channelId)
        .setSmallIcon(R.drawable.ic_dumbbell)
        .setContentTitle(copy.title)
        .setContentText(copy.body)
        .setColor(copy.accentColor)
        .setOngoing(true)
        .setVisibility(Notification.VISIBILITY_PUBLIC)
        .setContentIntent(openPi)
        .setOnlyAlertOnce(true)
        .setCategory("live_update")
        .setShortCriticalText(copy.chipText)
        .addExtras(Bundle().apply {
            putBoolean(EXTRA_REQUEST_PROMOTED_ONGOING, true)
        })

    if (copy.quote.isNotEmpty()) {
        builder.setSubText(copy.quote)
    }

    when (copy.phase) {
        "resting" -> builder
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setWhen(System.currentTimeMillis() + copy.restRemaining * 1000L)
        else -> if (copy.startedAt > 0L) builder
            .setUsesChronometer(true)
            .setChronometerCountDown(false)
            .setWhen(copy.startedAt)
    }

    when (copy.phase) {
        "resting" -> {
            builder.addAction(platformAction(context, "minus-15", "−15s"))
            builder.addAction(platformAction(context, "skip",     "Skip rest"))
            builder.addAction(platformAction(context, "plus-15",  "+15s"))
        }
        "rest-done" -> {
            builder.addAction(platformAction(context, "logged", "Logged it"))
            builder.addAction(platformAction(context, "finish", "Finish"))
        }
        "complete" -> builder.addAction(platformAction(context, "finish", "Finish"))
        else -> builder.addAction(platformAction(context, "finish", "Finish workout"))
    }

    // ── ProgressStyle: one segment per exercise ──────────────────────────────
    // Each exercise is allotted segUnits units; the tracker lands inside the
    // current exercise based on completed sets so far.
    val segUnits = 100
    val totalUnits = segUnits * copy.totEx

    val completedInCurEx = (copy.setIndex - 1).coerceIn(0, copy.totalSets)
    val intoEx = (completedInCurEx.toDouble() / copy.totalSets * segUnits).toInt()
    val progress = if (copy.phase == "complete") {
        totalUnits
    } else {
        (((copy.curEx - 1) * segUnits) + intoEx).coerceIn(0, totalUnits)
    }

    val segments = (1..copy.totEx).map { idx ->
        val color = when {
            copy.phase == "complete" -> LIFT_GOLD
            idx < copy.curEx         -> LIFT_PINK_FILLED
            idx == copy.curEx        -> copy.accentColor
            else                     -> LIFT_TRACK_REMAIN
        }
        Notification.ProgressStyle.Segment(segUnits).setColor(color)
    }

    val points = (1 until copy.totEx).map { idx ->
        Notification.ProgressStyle.Point(idx * segUnits).setColor(Color.WHITE)
    }

    val style = Notification.ProgressStyle()
        .setStyledByProgress(false)
        .setProgress(progress)
        .setProgressTrackerIcon(Icon.createWithResource(context, R.drawable.ic_dumbbell))
        .setProgressSegments(segments)
        .setProgressPoints(points)

    builder.setStyle(style)
    return builder.build()
}

internal fun buildCompatWorkoutNotification(
    context: Context,
    snap: JSONObject,
    channelId: String,
): Notification {
    val copy = parseWorkoutNotifCopy(snap)

    val openPi = PendingIntent.getActivity(
        context, 0,
        Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        },
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val builder = NotificationCompat.Builder(context, channelId)
        .setSmallIcon(R.drawable.ic_dumbbell)
        .setContentTitle(copy.title)
        .setContentText(copy.body)
        .setColor(copy.accentColor)
        .setColorized(true)
        .setOngoing(true)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setContentIntent(openPi)
        .setOnlyAlertOnce(true)

    if (copy.quote.isNotEmpty()) {
        builder.setSubText(copy.quote)
    }

    when (copy.phase) {
        "resting" -> builder
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setWhen(System.currentTimeMillis() + copy.restRemaining * 1000L)
        else -> if (copy.startedAt > 0L) builder
            .setUsesChronometer(true)
            .setChronometerCountDown(false)
            .setWhen(copy.startedAt)
    }

    when (copy.phase) {
        "resting" -> {
            builder.addAction(compatAction(context, "minus-15", "−15s"))
            builder.addAction(compatAction(context, "skip",     "Skip rest"))
            builder.addAction(compatAction(context, "plus-15",  "+15s"))
        }
        "rest-done" -> {
            builder.addAction(compatAction(context, "logged", "Logged it"))
            builder.addAction(compatAction(context, "finish", "Finish"))
        }
        "complete" -> builder.addAction(compatAction(context, "finish", "Finish"))
        else -> builder.addAction(compatAction(context, "finish", "Finish workout"))
    }

    if (Build.VERSION.SDK_INT >= 36) {
        builder.setCategory("live_update")
    } else {
        builder.setCategory(NotificationCompat.CATEGORY_PROGRESS)
    }

    return builder.build()
}

@RequiresApi(26)
private fun platformAction(
    context: Context,
    actionKey: String,
    label: String,
): Notification.Action {
    val intent = Intent(context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        putExtra(MainActivity.EXTRA_NOTIF_ACTION, actionKey)
    }
    val pi = PendingIntent.getActivity(
        context, actionKey.hashCode(), intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    return Notification.Action.Builder(
        Icon.createWithResource(context, R.drawable.ic_dumbbell),
        label, pi
    ).build()
}

private fun compatAction(
    context: Context,
    actionKey: String,
    label: String,
): NotificationCompat.Action {
    val intent = Intent(context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        putExtra(MainActivity.EXTRA_NOTIF_ACTION, actionKey)
    }
    val pi = PendingIntent.getActivity(
        context, actionKey.hashCode(), intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    return NotificationCompat.Action.Builder(0, label, pi).build()
}
