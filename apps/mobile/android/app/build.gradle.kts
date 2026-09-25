import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val localSigningProperties = Properties()
val localSigningPropertiesFile = rootProject.file("key.properties")
if (localSigningPropertiesFile.exists()) {
    FileInputStream(localSigningPropertiesFile).use {
        localSigningProperties.load(it)
    }
}

fun releaseSigningValue(propertyName: String, environmentName: String): String? {
    val environmentValue = System.getenv(environmentName)?.trim()
    if (!environmentValue.isNullOrEmpty()) {
        return environmentValue
    }
    return localSigningProperties.getProperty(propertyName)?.trim()
        ?.takeIf { it.isNotEmpty() }
}

val releaseStoreFile = releaseSigningValue(
    "storeFile",
    "QORE_ANDROID_KEYSTORE_PATH",
)
val releaseStorePassword = releaseSigningValue(
    "storePassword",
    "QORE_ANDROID_STORE_PASSWORD",
)
val releaseKeyAlias = releaseSigningValue(
    "keyAlias",
    "QORE_ANDROID_KEY_ALIAS",
)
val releaseKeyPassword = releaseSigningValue(
    "keyPassword",
    "QORE_ANDROID_KEY_PASSWORD",
)
val releaseSigningConfigured = listOf(
    releaseStoreFile,
    releaseStorePassword,
    releaseKeyAlias,
    releaseKeyPassword,
).all { !it.isNullOrBlank() }

android {
    namespace = "com.qore.mobile.qore_mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.qore.mobile.qore_mobile"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = 28
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (releaseSigningConfigured) {
            create("release") {
                storeFile = rootProject.file(releaseStoreFile!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            // Never fall back to the debug key. CI intentionally compiles an
            // unsigned release bundle; the Owner signs the Play upload bundle
            // locally with credentials that never enter GitHub.
            signingConfig = if (releaseSigningConfigured) {
                signingConfigs.getByName("release")
            } else {
                null
            }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}


dependencies {
    implementation("androidx.biometric:biometric:1.1.0")
}
