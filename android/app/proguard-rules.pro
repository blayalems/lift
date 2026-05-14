# Keep the JavaScript interface so Proguard doesn't strip annotated methods
-keepclassmembers class io.github.blayalems.lift.LiftBridge {
    @android.webkit.JavascriptInterface <methods>;
}
