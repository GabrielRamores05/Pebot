# Validation Guide: Tablet Parity

## Prerequisites
- Android Studio (Windows/macOS/Linux)
- Android SDK 34 (compileSdk), minSdk 26
- Pebot web app running locally (for sync testing)

## Test Scenarios

### Scenario 1: Login & Staff Management
1. Launch tablet app with no staff records
2. Enter PIN `123456` → should auto-create admin and log in
3. Navigate to Staff tab → add a new staff member with role KITCHEN
4. Log out (Settings → Logout)
5. Log in with new staff PIN → should access Kitchen Display only

**Expected**: Role-based navigation restricts non-admin roles from Settings/Staff tabs

### Scenario 2: Order with Product Options
1. POS → select "Americano" product
2. Options sheet shows "Size" (Small/Medium/Large) — single selection
3. Add to cart, proceed to checkout
4. Select table from dropdown
5. Choose GCash → upload screenshot → Complete Order
6. Order confirmation dialog shows barcode

**Expected**: Order saved with table assignment, payment screenshot stored, receipt printed

### Scenario 3: Inventory Deduction
1. Create product "Latte" with recipe: 20g Coffee Beans, 100ml Milk
2. Place order for 2 Lattes via POS
3. Navigate to Inventory → Ingredients → check Coffee Beans

**Expected**: Coffee Beans stock reduced by 40g (2 × 20g), transaction logged as USAGE type

### Scenario 4: Real-time Sync
1. Start web app on localhost:3000
2. Set tablet sync server URL to local IP in Settings → System
3. Enable sync
4. From web app, change an order status to "PREPARING"

**Expected**: Tablet Live Orders board updates in real-time without manual refresh

### Scenario 5: Analytics Export
1. Navigate to Analytics screen
2. Select MONTH time range
3. Verify bar chart shows sales data
4. Go to Settings → Export Data

**Expected**: JSON includes new entities (reviews, audit events, staff documents)

### Scenario 6: Staff Attendance
1. Log in as staff member
2. Navigate to Staff → Attendance tab
3. Clock in → verify timestamp
4. After 4 hours, clock out → verify hours calculated

**Expected**: Attendance record stored, hours calculated correctly with break deduction

### Scenario 7: Expense with Category
1. Navigate to Expenses
2. Add new expense: ₱500, category "Utilities", supplier "Manila Electric"
3. Filter by category

**Expected**: Expense appears in filtered list, supplier linked correctly

## Run Commands

```bash
# From my-app/ (web app)
npm run lint        # 0 errors
npx tsc --noEmit    # no errors
npm run test:unit   # 422 tests pass

# From cafeos-tablet/ (Android)
./gradlew lintDebug         # 0 errors
./gradlew testDebugUnitTest # all tests pass
./gradlew assembleDebug     # APK builds
```

## Acceptance Criteria Checklist

- [ ] All Windows modules have tablet screens (except /menu)
- [ ] Room entities match Prisma schema
- [ ] Order lifecycle works identically on both platforms
- [ ] BIR receipt numbering sequential and immutable
- [ ] Inventory deductions use recipe linkage
- [ ] Staff roles enforced in navigation and sync
- [ ] Export/import preserves all data
- [ ] Offline-first: all operations work without network
- [ ] Unit tests for new ViewModel/DAO logic
