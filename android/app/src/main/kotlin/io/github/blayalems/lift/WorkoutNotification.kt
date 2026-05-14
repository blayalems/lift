package io.github.blayalems.lift

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.Icon
import android.os.Bundle
import androidx.annotation.RequiresApi
import org.json.JSONObject

/**
 * Android 16 (API 36+) progress-centric Live Update notification builder.
 *
 * Renders the workout as a journey: each exercise is a segment on the
 * progress bar, the tracker icon shows where the user is in the workout,
 * and points mark exercise boundaries. The status-bar chip text is sourced
 * from setShortCriticalText (rest timer when resting, otherwise "Ex N/M").
 *
 * To be eligible for promotion to a Live Update chip we set
 * EXTRA_REQUEST_PROMOTED_ONGOING and avoid setColorized — the system
 * rejects colorized notifications for promotion.
 *
 * Older API levels (26–35) continue to use NotificationCompat builders
 * inside LiftBridge / WorkoutService — ProgressStyle has no compat backport.
 */
private const val LIFT_PINK         = 0xFFE63B5D.toInt()
private const val LIFT_PINK_FILLED  = 0xFFB12546.toInt()
private const val LIFT_TRACK_REMAIN = 0x33FFFFFF

// Platform key (Notification.EXTRA_REQUEST_PROMOTED_ONGOING — string literal kept
// for forward-compat in case the constant moves between SDK previews).
private const val EXTRA_REQUEST_PROMOTED_ONGOING = "android.requestPromotedOngoing"

@RequiresApi(36)
internal fun buildProgressStyleNotification(
    context: Context,
    snap: JSONObject,
    channelId: String,
): Notification {
    val phase         = snap.optString("phase", "set-up-next")
    val dayTitle      = snap.optString("dayTitle", "Workout")
    val exName        = snap.optString("exName", "")
    val setIndex      = snap.optInt("setIndex", 1)
    val totalSets     = snap.optInt("totalSets", 1).coerceAtLeast(1)
    val curEx         = snap.optInt("currentExercise", 1).coerceAtLeast(1)
    val totEx         = snap.optInt("totalExercises", 1).coerceAtLeast(1)
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

    val chipText = when (phase) {
        "resting" -> "%d:%02d".format(restRemaining / 60, restRemaining % 60)
        "rest-done" -> "Ready"
        else -> "Ex $curEx/$totEx"
    }

    val builder = Notification.Builder(context, channelId)
        .setSmallIcon(R.drawable.ic_dumbbell)
        .setContentTitle(title)
        .setContentText(body)
        .setColor(LIFT_PINK)
        .setOngoing(true)
        .setVisibility(Notification.VISIBILITY_PUBLIC)
        .setContentIntent(openPi)
        .setOnlyAlertOnce(true)
        .setCategory(Notification.CATEGORY_PROGRESS)
        .setShortCriticalText(chipText)
        .addExtras(Bundle().apply {
            putBoolean(EXTRA_REQUEST_PROMOTED_ONGOING, true)
        })

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
            builder.addAction(platformAction(context, "minus-15", "−15s"))
            builder.addAction(platformAction(context, "skip",     "Skip rest"))
            builder.addAction(platformAction(context, "plus-15",  "+15s"))
        }
        "rest-done" -> {
            builder.addAction(platformAction(context, "logged", "Logged it"))
            builder.addAction(platformAction(context, "finish", "Finish"))
        }
        else -> builder.addAction(platformAction(context, "finish", "Finish workout"))
    }

    // ── ProgressStyle: one segment per exercise ──────────────────────────────
    // Each exercise is allotted SEG_UNITS units; the tracker lands inside the
    // current exercise based on completed sets so far.
    val segUnits = 100
    val totalUnits = segUnits * totEx

    val completedInCurEx = when (phase) {
        "resting", "rest-done" -> setIndex
        else -> setIndex - 1
    }.coerceIn(0, totalSets)
    val intoEx = (completedInCurEx.toDouble() / totalSets * segUnits).toInt()
    val progress = (((curEx - 1) * segUnits) + intoEx).coerceIn(0, totalUnits)

    val segments = (1..totEx).map { idx ->
        val color = when {
            idx <  curEx -> LIFT_PINK_FILLED
            idx == curEx -> LIFT_PINK
            else         -> LIFT_TRACK_REMAIN
        }
        Notification.ProgressStyle.Segment(segUnits).setColor(color)
    }

    val points = (1 until totEx).map { idx ->
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

@RequiresApi(23)
private fun platformAction(
    context: Context,
    actionKey: String,
    label: String,
): Notification.Action {
    val intent = Intent(context, NotificationActionReceiver::class.java).apply {
        action = "io.github.blayalems.lift.NOTIF_ACTION"
        putExtra(NotificationActionReceiver.EXTRA_ACTION, actionKey)
    }
    val pi = PendingIntent.getBroadcast(
        context, actionKey.hashCode(), intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    return Notification.Action.Builder(
        Icon.createWithResource(context, R.drawable.ic_dumbbell),
        label, pi
    ).build()
}
