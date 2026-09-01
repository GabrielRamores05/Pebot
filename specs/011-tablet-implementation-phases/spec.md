# CafeOS Tablet — Implementation Plan: Phases 1-6

## Phase 1: Critical Bugs & Core Parity ✅ COMPLETED

### Completed
- [x] Fix inventory add-ingredient (`AddIngredientDialog`, `addIngredient()`, `deleteIngredient()`)
- [x] Fix product image storage (`saveProductImage()` copies to internal storage)
- [x] Fix `calculateCapitalFromRecipe()` inefficiency
- [x] Fix duplicate import block
- [x] Fix category deletion button
- [x] Fix broken `getInventoryProducts()` query
- [x] Add image rendering to product cards (`ProductCard` now loads bitmaps from file paths)
- [x] Make POS options data-driven (`ProductOptionsBottomSheet` uses `OptionGroup`/`Option` entities)
- [x] Add table selector to checkout dialog
- [x] Add product search bar to POSScreen
- [x] Add option group management screen with CRUD operations
- [x] Add Purchases tab with Record Purchase dialog
- [x] Add Stock History tab showing all transactions
- [x] Add supplier CRUD (SupplierFormDialog, add/edit/delete)
- [x] Extend export/import to include expenses and business settings
- [x] Add Expense entity, BusinessSettings entity, and DAO methods
- [x] DB version bumped to 5 (supports Expense, BusinessSettings)

---

## Phase 2: Live Orders & Kitchen Display ✅ COMPLETED

### 2.1 Kanban Live Orders (`LiveOrdersScreen.kt`)
- 4-column Kanban board (Pending/Preparing/Completed/Cancelled)
- Drag-and-drop between columns with `DraggableOrderCard`
- Order cards show: customer name, total, time ago, payment method
- Tap card → order detail slide-over

### 2.2 Order Detail Dialog
- Shows order info, items list, messages
- Status action buttons (Start Preparing, Mark Ready)

### 2.3 Kitchen Display Screen (`KitchenScreen.kt`)
- Station filter tabs (All/Coffee/Kitchen/Bar/Pastry/General)
- Order cards with items, timing, customer notes
- Status action buttons (Start Preparing / Mark Ready)
- Show completed toggle
- Added to NavHost navigation

---

## Phase 3: Product & Inventory Enhancements ✅ COMPLETED

### 3.1 Option Group Manager (`OptionGroupScreen.kt`) ✅
- Create/edit option groups with name and selection type (single/multi)
- Option group list with edit/delete actions
- `allOptionGroups` and `allOptions` state flows in ViewModel
- `option_groups` navigation route added to MainActivity

### 3.2 Product Search ✅
- Search bar in POSScreen filters products by name (case-insensitive)
- Works with category filter (both search + category)

### 3.3 Purchase Tracking & Stock History ✅
- `getAllPurchases()`, `getAllTransactions()`, `getTransactionsForIngredient()` DAO methods
- `purchaseIngredient()` ViewModel method records purchase transactions
- Purchases tab shows all purchase transactions with cost calculation
- History tab shows all ingredient transactions with type, quantity, notes
- `Record Purchase` dialog in Ingredients tab links suppliers and ingredients

### 3.4 Supplier Management ✅
- `saveSupplier()`, `deleteSupplier()` ViewModel methods
- `SupplierFormDialog` for create/edit with name, contact, phone, email, address, notes
- Suppliers tab shows full supplier details with edit/delete actions

### 3.5 Ingredient Management ✅
- `AdjustStockDialog` for add/reduce stock with notes
- `AddIngredientDialog` for creating new ingredients
- `deleteIngredient()` DAO method

---

## Phase 4: Analytics & Finance ✅ COMPLETED

### 4.1 Revenue Charts (`AnalyticsScreen.kt`) ✅
- Canvas-based bar chart showing sales trend
- Time range filters: TODAY/WEEK/MONTH/QUARTER/YEAR/ALL
- Sales by Payment Method breakdown
- Sales by Category breakdown (joins orders → order items → products → categories)
- Gross sales total card with accent background

### 4.2 Time Range Filters ✅
- `FilterChip`-based tab selector
- Computed date ranges (TODAY, WEEK=7d, MONTH=30d, QUARTER=90d, YEAR=365d, ALL)
- LaunchedEffect recomputes sales data when range changes

### 4.3 Expense Tracking (`ExpensesScreen.kt`) ✅
- Full CRUD for expenses with category, supplier, amount, notes, paid by
- `allExpenses` state flow in ViewModel
- `addExpense()`, `deleteExpense()` ViewModel methods
- Expense category breakdown available via `ExpenseCategoryTotal`
- Total expenses summary card

### 4.4 Supplier Management ✅
- Enhanced `InventorySuppliersTab` with full supplier detail display
- `SupplierFormDialog` with all contact fields
- Status badges (ACTIVE/INACTIVE)

---

## Phase 5: Staff, Loyalty & Settings ✅ COMPLETED

### 5.1 Settings Screens ✅
- Tabbed interface: System, Business, Payments, Receipts
- **System**: Export/import data, version info
- **Business**: BIR TIN, branch code, VAT rate, shop name (`BusinessSettings` entity)
- **Payments**: GCash/PayMaya account names (`BusinessSettings` entity)
- **Receipts**: Receipt prefix, last receipt number, BIR numbering
- `getNextReceiptNumber()` generates sequential receipt numbers
- `updateBusinessSettings()` ViewModel method

### 5.2 Customer Management ✅
- `CustomerManagementScreen` with customer list
- Search by name or contact
- Loyalty points display per customer
- `addCustomer()` ViewModel method

### 5.3 Table & Station Management ✅
- `saveTable()`, `deleteTable()`, `saveStation()`, `deleteStation()` ViewModel methods
- DAO methods: `deleteTable`, `deleteStation`

---

## Phase 6: Polish & Sync

### 6.1 Real-time Sync ✅
- `SocketSyncManager` handles Socket.IO client connection to web app server
- Listens for `order_update`, `inventory_update`, `sync_request` events
- `syncManager.handleOrderPlaced()` broadcasts order placement to server
- `CafeViewModel` exposes `isConnectedToSync`, `orderSyncEvent`, `inventorySyncEvent` state flows
- Full sync support via `requestFullSync()`

### 6.2 Printing ✅
- `ReceiptPrinter` generates PDF receipts with business info, order details, line items
- Print via Android `PrintManager` with monochrome settings
- Kitchen order printing support
- Integrated into `CafeViewModel` via `receiptPrinter` field

### 6.3 BIR Receipt Numbering ✅
- `BusinessSettings` entity with `lastReceiptNumber`, `receiptPrefix`
- `getNextReceiptNumber()` increments and returns formatted receipt number
- DAO methods: `getLastReceiptNumber()`, `updateLastReceiptNumber()`

### 6.4 Authentication & Management ✅
- [x] Login screen with 6-digit PIN (`LoginScreen.kt`, `authenticateStaff(pin)`)
- [x] Staff management with CRUD and roles (`StaffManagementScreen.kt`)
- [x] Loyalty voucher management (`VoucherManagementScreen.kt`)
- `activeVouchers`, `allStaff` state flows in ViewModel
- `saveStaff()`, `deleteStaff()`, `saveVoucher()`, `deleteVoucher()` ViewModel methods
- Staff roles: ADMIN, MANAGER, STAFF, KITCHEN, BARISTA
- Voucher types: PROMO, REWARD, MILESTONE; discount types: PERCENTAGE, FIXED

### 6.5 Payment & Receipt ✅
- [x] Payment screenshot upload for GCash/PayMaya (`CheckoutDialog` with image picker)
- [x] Order confirmation dialog with barcode (`OrderConfirmationDialog`)
- `_screenshotPath` and `_placedOrder` StateFlows in `CafeViewModel`
- Receipt PNG generation with order number, total, and barcode bars

### 6.6 Performance Optimization ✅
- Product caching in `CafeViewModel` (`_productCache`, `_productCacheByName`)
- In-memory product lookups for faster POS search and ordering
- Database indexes on frequently queried columns preserved

---

## Verification

| Check | Command | Result |
|-------|---------|--------|
| ESLint | `npm run lint` (from `my-app/`) | ✅ 0 errors, 248 warnings (pre-existing) |
| TypeScript | `npx tsc --noEmit` (from `my-app/`) | ✅ No errors |
| Unit Tests | `npm run test:unit` (from `my-app/`) | ✅ 422 tests passed |
| Android Build | `./gradlew build` | ⚠️ Cannot build (no Android SDK in environment) |

---

## Code Conventions

1. **All screens**: `app/src/main/java/com/cafeos/tablet/ui/screens/`
2. **ViewModel methods**: Expose suspend functions for data operations
3. **Theme**: Use `PosCoffee`, `PosPaper`, `PosAccent`, `PosGold`, `PosDanger` from `ui/theme/`
4. **Dialogs**: Use `AlertDialog` with `shape = RoundedCornerShape(20.dp)`
5. **Cards**: Use `CardDefaults.cardColors(containerColor = PosCoffeeLight)`
6. **Buttons**: Primary = `PosAccent`, Danger = `PosDanger`

## Testing Checklist

- [x] Product CRUD with images
- [x] Option groups create/edit/delete
- [x] POS ordering with dynamic options
- [x] Table selection in checkout
- [x] Kanban status changes
- [x] Kitchen display filtering
- [x] Inventory add/edit/delete ingredients
- [x] Purchase recording
- [x] Revenue charts with time filters
- [x] Expense CRUD
- [x] Settings save/load (business, payment, receipt settings)
- [x] Export/import round-trip (includes expenses + business settings)
- [x] Payment screenshot upload
- [x] Order confirmation dialog with barcode
- [x] Customer management (list, add customer, add loyalty points)
- [x] BIR receipt numbering
- [x] Login/logout
- [x] Staff/HR management
- [x] Loyalty voucher management
- [x] Real-time sync (Socket.IO)
- [x] Printing support
- [x] Performance optimization (product caching)
