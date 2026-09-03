# Keep app classes and generated models
-keep class com.cafeos.tablet.** { *; }
-keep class androidx.lifecycle.** { *; }
-keep class kotlinx.serialization.** { *; }

# Keep Room entities and DAOs
-keep class com.cafeos.tablet.data.** { *; }

# Prevent R8 from stripping Compose generated classes if needed
-keepattributes *Annotation*
-keep class * extends androidx.compose.runtime.internal.ComposableLambda { *; }
