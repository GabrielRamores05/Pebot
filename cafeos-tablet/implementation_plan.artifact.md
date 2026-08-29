# Implementation Plan: CaféOS Tablet APK (Native Android)

Create a standalone Android APK for tablets implementing the core POS, Inventory, and Product management features with a premium, minimal design. This app will run entirely offline using a local SQLite database that matches the CaféOS schema.

## User Review Required

> [!IMPORTANT]
> This plan proposes a **Native Android App (Jetpack Compose)** rather than a web-wrapper (Capacitor). This ensures a "premium" feel and avoids the complexities of embedding a Node.js server and Prisma engine on Android, which is notoriously difficult to set up quickly.

## Proposed Changes

### Project Setup
- [NEW] `cafeos-tablet/build.gradle.kts`: Project-level build configuration.
- [NEW] `cafeos-tablet/settings.gradle.kts`: Settings for the Android module.
- [NEW] `cafeos-tablet/app/build.gradle.kts`: App-level configuration with Room and Compose dependencies.
- [NEW] `cafeos-tablet/app/src/main/AndroidManifest.xml`: Android manifest.

### Data Layer (Room Persistence)
- [NEW] `cafeos-tablet/app/src/main/java/com/cafeos/tablet/data/`
    - `Entities.kt`: Room entities for `Product`, `Category`, `Order`, `OrderItem`, `Ingredient`, `IngredientTransaction`.
    - `CafeDao.kt`: Data access objects for all core operations.
    - `CafeDatabase.kt`: Room database definition.

### UI Layer (Jetpack Compose)
- [NEW] `cafeos-tablet/app/src/main/java/com/cafeos/tablet/ui/`
    - `theme/`: Material 3 theme configuration (Premium look).
    - `POSScreen.kt`: Grid of products with a slide-out cart for ordering.
    - `InventoryScreen.kt`: Management view for ingredient stocks.
    - `ProductScreen.kt`: Product catalog management.
    - `OrderHistoryScreen.kt`: List of past orders with invoice view.
    - `AnalyticsScreen.kt`: Minimal dashboard for daily sales and top products.

### Navigation & Main Activity
- [NEW] `cafeos-tablet/app/src/main/java/com/cafeos/tablet/MainActivity.kt`: Entry point with navigation host.

## Verification Plan

### Manual Verification
- Verify that the app boots on a tablet emulator.
- Verify POS flow: Select products, view cart, place order.
- Verify Inventory: Add/Remove stock and see updates.
- Verify Order History: View placed orders.
- Verify Analytics: View daily totals.
- Verify Database Export: Export SQLite file to Downloads.
