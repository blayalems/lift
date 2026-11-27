const fs = require("node:fs");
const path = require("node:path");

describe("Android 17 (API 37) upgrade and CI contracts", () => {
  const root = path.join(__dirname, "..");
  const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
  const ktDir = ["android", "app", "src", "main", "kotlin", "io", "github", "blayalems", "lift"];

  test("Gradle config targets Android 17 (API 37) v2.0.0 with AGP 9.1.1 rules", () => {
    const appGradle = read("android", "app", "build.gradle.kts");
    const rootGradle = read("android", "build.gradle.kts");
    const settingsGradle = read("android", "settings.gradle.kts");
    const wrapperProps = read("android", "gradle", "wrapper", "gradle-wrapper.properties");

    expect(appGradle).toContain("compileSdk = 37");
    expect(appGradle).toContain("targetSdk = 37");
    expect(appGradle).toContain("minSdk = 26");
    expect(appGradle).toContain("versionCode = 26");
    expect(appGradle).toContain('versionName = "2.0.0"');
    expect(appGradle).toContain("sourceCompatibility = JavaVersion.VERSION_17");
    expect(appGradle).toContain("targetCompatibility = JavaVersion.VERSION_17");
    expect(appGradle).toContain('implementation("androidx.core:core-ktx:1.18.0")');

    expect(settingsGradle).toContain('id("com.android.application") version "9.1.1"');
    expect(wrapperProps).toContain("gradle-9.3.1-bin.zip");

    [appGradle, rootGradle, settingsGradle].forEach((gradleFile) => {
      expect(gradleFile).not.toContain("org.jetbrains.kotlin.android");
      expect(gradleFile).not.toContain("kotlinOptions");
    });
  });

  test("CI workflow installs Android 37 SDK/build-tools and uses Gradle 9.3.1", () => {
    const workflow = read(".github", "workflows", "build-apk.yml");

    expect(workflow).toContain('"platforms;android-37"');
    expect(workflow).toContain('"build-tools;37.0.0"');
    expect(workflow).toContain("gradle-version: '9.3.1'");
    expect(workflow).toContain("java-version: '17'");
    expect(workflow).toContain("Lift v2.0.0");
    expect(workflow).toContain("Android 17");
  });

  test("AndroidManifest declares API 37 resizability, permissions, and HabitReminderReceiver", () => {
    const manifest = read("android", "app", "src", "main", "AndroidManifest.xml");
    const doc = new DOMParser().parseFromString(manifest, "text/xml");
    expect(doc.querySelector("parsererror")).toBeNull();

    expect(manifest).toContain("android.permission.POST_NOTIFICATIONS");
    expect(manifest).toContain("android.permission.POST_PROMOTED_NOTIFICATIONS");
    expect(manifest).toContain("android.permission.FOREGROUND_SERVICE_HEALTH");
    expect(manifest).toContain('android:resizeableActivity="true"');
    expect(manifest).toContain('android:enableOnBackInvokedCallback="true"');
    expect(manifest).toContain(
      'android:configChanges="orientation|screenSize|smallestScreenSize|screenLayout|keyboardHidden|density|uiMode"'
    );
    expect(manifest).toContain('android:name=".WorkoutService"');
    expect(manifest).toContain('android:foregroundServiceType="health"');
    expect(manifest).toContain('android:name=".HabitReminderReceiver"');
    expect(manifest).toContain('android:exported="false"');
  });

  test("MainActivity handles API 35-37 edge-to-edge, predictive back, and SDK injection", () => {
    const mainActivity = read(...ktDir, "MainActivity.kt");

    expect(mainActivity).toContain("WindowCompat.setDecorFitsSystemWindows(window, false)");
    expect(mainActivity).toContain("WindowInsetsControllerCompat");
    expect(mainActivity).toContain("Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM");
    expect(mainActivity).toContain("setBackConsumerActive(active: Boolean)");
    expect(mainActivity).toContain("syncBackCallbackState()");
    expect(mainActivity).toContain("OnBackPressedCallback");
    expect(mainActivity).toContain('dispatchAction("navigate-back")');
    expect(mainActivity).toContain("window.__liftHandleBack");
    expect(mainActivity).toContain("window.LIFT_ANDROID_SDK=${Build.VERSION.SDK_INT};");
    expect(mainActivity).toContain("window.LIFT_IS_NATIVE=true;");
    expect(mainActivity).toContain('uri.scheme == "https" && uri.host == "blayalems.github.io"');
    expect(mainActivity).not.toContain('startsWith("https://blayalems.github.io")');
  });

  test("WorkoutNotification & WorkoutService enforce Live Updates, phase accents, quote subtext, and vector-only icons", () => {
    const notif = read(...ktDir, "WorkoutNotification.kt");
    const service = read(...ktDir, "WorkoutService.kt");

    expect(notif).toContain("@RequiresApi(36)");
    expect(notif).toContain("Notification.ProgressStyle");
    expect(notif).toContain("setShortCriticalText");
    expect(notif).toContain('"android.requestPromotedOngoing"');
    expect(notif).toContain("setSubText(copy.quote)");
    expect(notif).toContain("LIFT_REST_BLUE");
    expect(notif).toContain("LIFT_EMERALD");
    expect(notif).toContain("LIFT_GOLD");
    expect(notif).toContain("LIFT_PINK");
    expect(notif).toContain("R.drawable.ic_dumbbell");
    expect(notif).toContain("canPostPromotedNotifications");
    expect(notif).toContain('getMethod("canPostPromotedNotifications")');

    // ProgressStyle notifications must never call setColorized(true) (blocked from promotion)
    const progressFnStart = notif.indexOf("internal fun buildProgressStyleNotification");
    const progressFnEnd = notif.indexOf("internal fun buildCompatWorkoutNotification");
    const progressFnBody = notif.slice(progressFnStart, progressFnEnd);
    expect(progressFnBody).not.toContain("setColorized(true)");

    // Zero raster Bitmap usage under Android 17 memory rules
    expect(notif).not.toMatch(/\bBitmap\b|\bBitmapFactory\b/);
    expect(service).not.toMatch(/\bBitmap\b|\bBitmapFactory\b/);

    expect(service).toContain("ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH");
    expect(service).toContain("canPostPromotedNotifications(this)");
    expect(service).toContain("buildWorkoutNotification(this, snap, CHANNEL_ID)");
    expect(service).toContain("LiftWidgetProvider.updateFromWorkoutState(this, snap)");
  });

  test("LiftBridge & HabitReminderReceiver expose v2 bridge APIs and permission-safe reminders", () => {
    const bridge = read(...ktDir, "LiftBridge.kt");
    const receiver = read(...ktDir, "HabitReminderReceiver.kt");

    const requiredBridgeMethods = [
      "fun onWorkoutState(json: String)",
      "fun clearWorkout()",
      "fun isNative(): Boolean",
      "fun setSystemBars(theme: String)",
      "fun setBackConsumerActive(active: Boolean)",
      "fun getAndroidInfo(): String",
      "fun updateWidgetEngagement(json: String)",
      "fun scheduleHabitReminder(delayMinutes: Int, title: String, body: String): Boolean",
      "fun cancelHabitReminder(): Boolean",
      "fun openNotificationSettings(): Boolean",
      "fun saveStateMirror(json: String): Boolean",
      "fun loadStateMirror(): String",
      "fun clearStateMirror(): Boolean",
      "fun saveBackupFile(filename: String, json: String)",
      "fun saveImageFile(filename: String, dataUrl: String)",
      "fun shareText(title: String, text: String): Boolean",
      "fun shareJsonFile(filename: String, json: String, title: String): Boolean",
      "fun shareImageFile(filename: String, dataUrl: String, title: String): Boolean",
      "fun haptic(patternJson: String): Boolean",
    ];
    requiredBridgeMethods.forEach((sig) => {
      expect(bridge).toContain(sig);
    });

    [
      '"sdk"',
      '"release"',
      '"isAndroid17"',
      '"supportsLiveUpdates"',
      '"supportsWidgetPreview"',
      '"canPostPromotedNotifications"',
      '"isLargeScreen"',
    ].forEach((key) => {
      expect(bridge).toContain(key);
    });

    expect(bridge).toContain("LiftWidgetProvider.updateEngagement(context,");
    expect(bridge).toContain("AlarmManager.RTC_WAKEUP");
    expect(bridge).toContain("setAndAllowWhileIdle");
    expect(bridge).not.toContain("SCHEDULE_EXACT_ALARM");
    expect(bridge).not.toContain("setExact");
    expect(bridge).toContain("Settings.ACTION_APP_NOTIFICATION_SETTINGS");
    expect(bridge).toContain("Settings.EXTRA_APP_PACKAGE");

    expect(receiver).toContain("class HabitReminderReceiver : BroadcastReceiver()");
    expect(receiver).toContain('const val CHANNEL_ID = "lift_reminders"');
    expect(receiver).toContain("Manifest.permission.POST_NOTIFICATIONS");
    expect(receiver).toContain("R.drawable.ic_dumbbell");
    expect(receiver).not.toMatch(/\bBitmap\b|\bBitmapFactory\b/);
    expect(receiver).not.toContain("R.string.reminder_");
  });

  test("AGENTS.md documents Android 17 (API 37) matrix and new LiftAndroid bridge methods", () => {
    const agents = read("AGENTS.md");

    expect(agents).toContain("compileSdk / targetSdk | 37");
    expect(agents).toContain("android-37");
    expect(agents).toContain("37.0.0");
    expect(agents).toContain("9.1.1");
    expect(agents).toContain("9.3.1");
    expect(agents).toContain("HabitReminderReceiver.kt");
    expect(agents).toContain("WorkoutNotification.kt");
    expect(agents).toContain("setBackConsumerActive(active)");
    expect(agents).toContain("updateWidgetEngagement(json)");
    expect(agents).toContain("scheduleHabitReminder(delayMinutes, title, body)");
    expect(agents).toContain("cancelHabitReminder()");
    expect(agents).toContain("openNotificationSettings()");
    expect(agents).toContain("window.LIFT_ANDROID_SDK");
  });
});
