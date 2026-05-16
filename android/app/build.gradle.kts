plugins {
    id("com.android.application")
}

android {
    namespace = "io.github.blayalems.lift"
    compileSdk = 36

    defaultConfig {
        applicationId = "io.github.blayalems.lift"
        minSdk = 26
        targetSdk = 36
        versionCode = 14
        versionName = "1.4.1"
    }

    signingConfigs {
        // Consistent debug keystore committed to the repo so every CI build
        // produces an APK that can be installed over the previous one without
        // needing to uninstall first.
        getByName("debug") {
            storeFile = rootProject.file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            isDebuggable = true
            signingConfig = signingConfigs.getByName("debug")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.18.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    // org.json is provided by the Android platform — do not add as a dependency
}
