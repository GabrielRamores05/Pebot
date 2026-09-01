# CaféOS Tablet — Finishing Plan

Goal: produce an installable Android APK that matches the Pebot web app's design, works completely offline, and can export/import all data to the main POS.

## Current State

- `cafeos-tablet/` has a working scaffold: Jetpack Compose, Room DB, basic screens.
- No Gradle wrapper (`gradlew`) — cannot build APK yet.
- Default Material 3 theme — does not match the web app's premium warm palette.
- Export is a commented stub. No import bridge in the main POS.
- No order options, no payments entity, no sync tracking.

## Phase 0: Make it Buildable

### 0.1 Add Gradle Wrapper
```bash
cd cafeos-tablet
gradle wrapper
```
If `gradle` command is unavailable, download `gradle-8.x-all.zip` from gradle.org and run:
```bash
gradle-8.x/bin/gradle wrapper
```
Commit `gradlew`, `gradlew.bat`, and `gradle/wrapper/`.

### 0.2 Fix `local.properties`
Ensure `cafeos-tablet/local.properties` contains:
```
sdk.dir=C\:\\Users\\<user>\\AppData\\Local\\Android\\Sdk
```

### 0.3 Verify First APK
```bash
./gradlew assembleDebug
```
APK output: `app/build/outputs/apk/debug/app-debug.apk`.

## Phase 1: Match Pebot Design System

The web app uses these tokens (`my-app/app/globals.css`):

| Token | Value | Usage |
|---|---|---|
| `--pos-ink` | `#1C1917` | Primary text |
| `--pos-ink-soft` | `#57534E` | Secondary text |
| `--pos-paper` | `#FAF7F2` | Screen background |
| `--pos-surface` | `#FFFFFF` | Cards/panels |
| `--pos-muted` | `#EDE8DE` | Dividers, disabled |
| `--pos-border` | `#DDD6C8` | Borders |
| `--pos-accent` | `#4A5D3A` | Primary action (green) |
| `--pos-danger` | `#B3261E` | Errors, delete |

Replicate in `app/src/main/java/com/cafeos/tablet/ui/theme/`:
- `Color.kt`: define `PosGreen`, `PosInk`, `PosPaper`, etc.
- `Type.kt`: use `SF Pro Display` fallback to system font, tight letter spacing `-0.01em`.
- `Theme.kt`: dark coffee background (`#1f1a17`), green accents for primary buttons, cream cards.

### 1.1 Screen-by-Screen Restyle

**POSScreen**
- Background: `#1f1a17` (dark coffee)
- Product grid: cream cards (`#fff9f3`) with rounded corners (`16dp`), subtle shadow
- Cart panel: right rail, `#2d221d` background, amber/gold total text
- Product tap: spring scale-in animation (0.35s cubic-bezier)
- Buttons: `#4A5D3A` green primary, full-width, `12dp` corner radius

**OrderHistoryScreen**
- Premium cards with status color coding:
  - PENDING: amber
  - PREPARING: blue
  - COMPLETED: green
  - CANCELLED: red
- Date/time in muted ink, amount in green bold

**InventoryScreen**
- Low-stock rows in danger red text
- Adjustment dialog: rounded `AlertDialog`, same color tokens

**ProductScreen**
- Read-only catalog cards matching POS grid style

**AnalyticsScreen**
- Daily sales in a `primaryContainer` card
- Top products as clean rows with dividers

## Phase 2: Complete the Data Model

Add these Room entities to `data/Entities.kt`:

```kotlin
@Entity(tableName = "OrderOption")
data class OrderOption(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val orderItemId: Int,
    val name: String,        // "Size", "Extra Shot"
    val value: String,       // "Large", "Oat Milk"
    val priceDelta: Double = 0.0
)

@Entity(tableName = "Payment")
data class Payment(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val orderId: Int,
    val method: String,      // CASH, GCASH, PAYMAYA
    val amountTendered: Double,
    val change: Double = 0.0,
    val screenshotPath: String? = null,
    val createdAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "SyncMeta")
data class SyncMeta(
    @PrimaryKey val id: Int = 1,
    val lastExportAt: Long = 0,
    val lastImportAt: Long = 0,
    val exportVersion: Int = 1
)

@Entity(tableName = "Customer")
data class Customer(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val contact: String? = null,
    val loyaltyPoints: Int = 0,
    val createdAt: Long = System.currentTimeMillis()
)
```

Update `CafeDao.kt` with queries for the new entities.

## Phase 3: Order Options / Modifiers

Before adding a product to cart, show a bottom sheet:
1. **Size**: Small / Medium / Large (+₱0 / +₱15 / +₱30)
2. **Temperature**: Hot / Cold
3. **Add-ons**: Extra Shot (+₱25), Oat Milk (+₱20), Whipped Cream (+₱10)

This mirrors the web app's option groups. Store selections as `OrderOption` rows linked to `OrderItem`.

## Phase 4: Payment / Checkout Flow

After "Complete Order":
1. Show **PaymentSheet** with:
   - Method selector: Cash / GCash / PayMaya
   - If Cash: amount tendered input, change calculated live
   - If GCash/PayMaya: attach screenshot from gallery
2. Save `Payment` record
3. Update `Order.status = COMPLETED`

## Phase 5: Export Bridge (Tablet → POS)

In `SettingsScreen`, add **Export All Data** button.

### 5.1 Export Format
File: `Downloads/CafeOS_Export_YYYY-MM-DD_HHmmss.json`

```json
{
  "version": 1,
  "shopId": "tablet-001",
  "exportedAt": 1725123456789,
  "products": [...],
  "categories": [...],
  "orders": [...],
  "orderItems": [...],
  "orderOptions": [...],
  "payments": [...],
  "ingredients": [...],
  "ingredientTransactions": [...],
  "customers": [...]
}
```

### 5.2 Export Logic
- Query every table
- Write JSON with `Gson` or `kotlinx.serialization`
- Update `SyncMeta.lastExportAt`
- Show success toast with file path

## Phase 6: Import Bridge (POS → Main App)

Add to `my-app/`:

### 6.1 API Route
`app/api/import/tablet/route.ts` (POST, admin-only)

1. Accept multipart file upload
2. Parse JSON, validate `version === 1`
3. Inside a Prisma transaction:
   - Upsert products by name/barcode
   - Upsert categories by name
   - Create orders (skip duplicates by `orderNumber`)
   - Create order items and options
   - Create payments
   - Apply inventory adjustments
   - Create/update customers
4. Return summary:
   ```json
   {
     "imported": { "orders": 42, "payments": 42, "products": 28 },
     "skipped": { "orders": 3 }
   }
   ```

### 6.2 Admin UI
`app/admin/settings/import/page.tsx`:
- File picker
- "Import" button
- Summary dialog with counts

## Phase 7: Polish

- App icon: use `Pebot.png` already copied to `mipmap-*`
- Splash screen: simple branded splash with logo
- Offline indicator: show "Offline Mode" in settings when no network
- Settings screen: seed data, export, about

## File Checklist

| File | Action |
|---|---|
| `gradlew`, `gradlew.bat`, `gradle/wrapper/` | NEW |
| `local.properties` | UPDATE sdk.dir |
| `app/src/main/res/mipmap-*/ic_launcher.png` | COPY from my-app/public/icons/Pebot.png |
| `data/Entities.kt` | ADD OrderOption, Payment, SyncMeta, Customer |
| `data/CafeDao.kt` | ADD queries for new entities |
| `ui/theme/Color.kt` | REPLACE with Pos tokens |
| `ui/theme/Type.kt` | SF Pro stack, tight tracking |
| `ui/theme/Theme.kt` | Dark coffee + green accent |
| `ui/screens/POSScreen.kt` | RESTYLE + add option bottom sheet |
| `ui/screens/OrderHistoryScreen.kt` | RESTYLE status colors |
| `ui/screens/ProductScreen.kt` | RESTYLE cards |
| `ui/screens/InventoryScreen.kt` | RESTYLE + low-stock red |
| `ui/screens/AnalyticsScreen.kt` | RESTYLE |
| `ui/screens/SettingsScreen.kt` | ADD export button + logic |
| `ui/CafeViewModel.kt` | ADD export function, payment flow |
| `my-app/app/api/import/tablet/route.ts` | NEW |
| `my-app/app/admin/settings/import/page.tsx` | NEW |

## Verification

1. `./gradlew assembleDebug` → APK builds
2. Install on tablet: `adb install app/build/outputs/apk/debug/app-debug.apk`
3. Place orders, adjust stock
4. Export JSON from Settings
5. Import JSON into main POS admin
6. Verify orders, payments, and inventory appear correctly
