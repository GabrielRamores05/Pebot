# Spec 010: CafeOS Tablet — Comprehensive Parity Plan

## 1. Pebot Windows Feature Baseline

### 1.1 Pages / Screens
| Module | Pebot Route | Description |
|--------|-------------|-------------|
| Customer Menu | `/menu` | QR ordering, categories, product cards, cart, loyalty, table scanner, reviews, best-sellers |
| Cart / Checkout | `/cart` | Item list, option editing, loyalty voucher auto-apply, payment method (Cash/GCash/PayMaya), payment screenshot upload, table selector, order confirmation |
| Order Tracking | `/order/[orderNumber]` | Live status steps, estimated wait time, queue position, follow-up messaging (text + voice), cancel order, invoice download with barcode, payment QR display |
| Live Orders | `/admin` | **Kanban board** (Pending/Preparing/Completed/Cancelled), drag-and-drop status changes, order detail slide-over, invoice viewer, voice settings, message notifications |
| POS Terminal | `/admin/terminal` | New order creation interface |
| Product Management | `/admin/products` | CRUD products, categories, BIR pricing (capital cost/margin/VAT), image upload, option group attachments, recipe/ingredient linking, review summary, best-seller badges |
| Inventory | `/admin/inventory` | Product stock levels, low-stock alerts, ingredient stock management, supplier management, production capacity planning, ingredient purchase tracking, stock adjustment |
| Stock History | `/admin/stock-history` | Stock movement history |
| Expenses | `/admin/expenses` | Expense CRUD, category filtering, supplier linking |
| Revenue | `/admin/revenue` | Charts (line/bar/pie), time filters, payment method breakdown, top products, category revenue, customer spending percentiles |
| Customers | `/admin/customers` | Customer analytics, tier classification (VIP/Regular/Casual/At-Risk), lifetime value, visit frequency, retention/churn rates |
| Loyalty | `/admin/loyalty` | Card CRUD, voucher management, settings (global/per-category), milestone mode, reward generation, coffee counting, membership codes |
| Staff / HR | `/admin/staff` | Team management, Schedule, Time Clock, Time Off, Payroll (SSS/PhilHealth/Pag-IBIG), Performance Reviews, Documents, Training |
| Tables | `/admin/tables` | CRUD tables, floor plan, sections, capacity, status (Available/Occupied/Needs Cleaning), guest management |
| Stations | `/admin/stations` | Kitchen station configuration |
| Kitchen Display | `/kitchen` | Station-filtered order cards, status transitions, message threading, follow-up toasts |
| Order History | `/admin/order-history` | Order history with filters |
| Reviews | `/admin/reviews` | Product reviews management |
| Audit Logs | `/admin/audit-logs` | Append-only event viewer |
| Settings | `/admin/settings` | Branding, Business (BIR/TIN/VAT/receipt), Loyalty settings, Payments (GCash/PayMaya QR), AI Consultant config, User management, Admin tools |
| AI Consultant | `/admin/consultant` | Chat interface with context about orders, inventory, staff, sales |
| Analytics | `/admin/analytics` | Tabbed: Overview, Revenue, Customers, Fulfillment, Vouchers |

### 1.2 API Routes
| Module | Key Endpoints |
|--------|---------------|
| Auth | `/api/auth/login`, `/api/auth/me` |
| Orders | `/api/orders` (GET/POST), `/api/orders/[id]` (GET/PATCH), `/api/orders/[id]/messages`, `/api/orders/[id]/follow-up`, `/api/orders/[id]/wait-time` |
| Products | `/api/products` (GET/POST/PATCH/DELETE), `/api/products/[id]/options`, `/api/products/[id]/option-groups`, `/api/option-groups` |
| Categories | `/api/categories` |
| Inventory | `/api/inventory`, `/api/ingredients`, `/api/ingredients/[id]/adjust`, `/api/ingredients/dashboard`, `/api/ingredients/transactions`, `/api/ingredients/purchases`, `/api/ingredients/production-capacity` |
| Tables | `/api/tables`, `/api/tables/entry`, `/api/tables/exit`, `/api/tables/guests`, `/api/tables/qr`, `/api/tables/clean-request` |
| Loyalty | `/api/loyalty/register`, `/api/loyalty/cards`, `/api/loyalty/settings`, `/api/loyalty/vouchers/*`, `/api/loyalty/rewards/*` |
| Staff/HR | `/api/staff`, `/api/attendance`, `/api/leave-requests`, `/api/schedules`, `/api/payroll`, `/api/performance-reviews`, `/api/training` |
| Finance | `/api/expenses`, `/api/expense-categories`, `/api/suppliers`, `/api/payments` |
| Analytics | `/api/analytics`, `/api/analytics/revenue`, `/api/analytics/fulfillment` |
| Settings | `/api/settings/branding`, `/api/settings/business`, `/api/settings/voice`, `/api/settings/users` |
| System | `/api/health`, `/api/backup`, `/api/restore`, `/api/upload`, `/api/audit-logs` |

### 1.3 Data Models (Prisma)
- User, Subscription, POSLicense
- Category, Product, Review, Inventory
- Ingredient, IngredientTransaction, Supplier, ProductIngredient
- ProductOption, OptionGroup, ProductOptionGroup, ProductOptionIngredient
- RestaurantTable, TableSession, TableGuest
- Order, OrderItem, OrderMessage, PaymentTransaction
- LoyaltyCard, LoyaltyTransaction, LoyaltyVoucher, LoyaltySetting
- Attendance, LeaveRequest, LeaveType, Schedule
- Payroll, PerformanceReview, StaffDocument, StaffTraining
- Expense, ExpenseCategory, BusinessSettings, Setting
- AuditEvent, AIConversation, AIMessage

### 1.4 Key UI Patterns
- **Kanban board**: Drag-and-drop columns for order status
- **Option groups**: Size/Temperature/Add-ons with single/multi selection
- **BIR pricing**: Capital cost + margin (PERCENTAGE/FIXED) + VAT
- **Recipe/BOM**: Product ingredients with quantities for capital calculation
- **Real-time**: Socket.IO for live updates
- **Media**: Image upload for products, payment screenshots, review images
- **Discounts**: PWD/Student validation with ID tracking

---

## 2. Critical Bugs Fixed

### Bug 1: Inventory Add-Ingredient
**Status**: FIXED
**Changes**:
- `CafeDao.kt`: Added `deleteIngredient()` method
- `CafeViewModel.kt`: Added `addIngredient()` and `deleteIngredient()` methods
- `InventoryScreen.kt`: Added `AddIngredientDialog` and "Add Ingredient" button in Ingredients tab

### Bug 2: Product Image Rendering
**Status**: FIXED
**Changes**:
- `CafeViewModel.kt`: Added `saveProductImage()` to copy selected images to app's internal storage as persistent files
- `ProductScreen.kt`: Updated image picker to save to persistent storage; `imageUrl` now stores file path instead of transient content URI
- Product cards: Image rendering to be added in implementation phase

### Bug 3: `calculateCapitalFromRecipe()` Inefficiency
**Status**: FIXED
**Changes**:
- `CafeViewModel.kt`: Now queries all ingredients once, builds map, then looks up — O(n) instead of O(n²)

### Bug 4: Duplicate Import Block
**Status**: FIXED
**Changes**:
- `CafeViewModel.kt`: Removed duplicated payment/customer insertion loop in `importAllData()`

### Bug 5: Category Deletion Button
**Status**: FIXED
**Changes**:
- `ProductScreen.kt`: Delete button now calls `onDelete(cat)` instead of no-op `onSave(cat.copy(name = cat.name))`
- `CafeViewModel.kt`: Added `deleteCategory()` method
- `CategoryManagerDialog`: Added `onDelete` callback parameter

### Bug 6: Broken `getInventoryProducts()` Query
**Status**: FIXED
**Changes**:
- `CafeDao.kt`: Removed cartesian-product query `LEFT JOIN Ingredient i ON 1=1`
- `CafeDao.kt`: Removed unused `InventoryProduct` data class

---

## 3. Implementation Plan — Module by Module

### 3.1 POS & Ordering
**Current State**: Basic POS with cart, checkout, PWD/Student discount, hardcoded options
**Gaps**:
- Options are hardcoded (Size/Temp/Add-ons), not data-driven from OptionGroup/Option entities
- No table selection during checkout
- No payment screenshot upload for GCash/PayMaya
- No order follow-up messaging
- No invoice generation with BIR compliance

**Implementation Tasks**:
1. **Data-driven options**: Replace hardcoded options in `POSScreen.kt` with `OptionGroup`/`Option` lookups per product
2. **Table selector**: Add table selection dropdown in checkout dialog, link order to table
3. **Payment proof**: Add camera/file upload for GCash/PayMaya payment screenshots
4. **Order confirmation**: Show success dialog with order number and barcode
5. **BIR invoice**: Generate BIR-compliant receipt with TIN, branch code, sequential number, VAT breakdown

### 3.2 Live Orders & Kanban
**Current State**: Queue tab with order cards, Tables tab, Stations tab
**Gaps**:
- No Kanban board with drag-and-drop columns
- No order detail slide-over
- No inline status change buttons on cards

**Implementation Tasks**:
1. **Kanban columns**: Redesign `LiveOrdersScreen` with 4 columns (Pending/Preparing/Completed/Cancelled)
2. **Drag and drop**: Implement touch-friendly drag-and-drop for status changes
3. **Order cards**: Add customer name, items count, total, table, time ago, payment method badges
4. **Detail slide-over**: Show order items, messages, invoice preview
5. **Voice settings**: Add volume/speed controls for voice notifications

### 3.3 Product Management
**Current State**: CRUD products, categories, recipe editor, BIR pricing, image picker
**Gaps**:
- Option group editor UI missing (entities exist but no management screen)
- Product images not rendered in cards
- No product search/filter
- No bulk operations

**Implementation Tasks**:
1. **Option group manager**: New screen to create/edit option groups and options
2. **Image rendering**: Add `Image` composable to `ProductCardEditable` and `ProductCard`
3. **Product search**: Add search bar in product list
4. **Bulk actions**: Select multiple products for batch delete/disable

### 3.4 Inventory Management
**Current State**: Products tab, Ingredients tab with adjust stock, Suppliers tab, Capacity tab
**Gaps**:
- No ingredient creation (NOW FIXED)
- No ingredient deletion
- No purchase tracking UI
- No stock history view

**Implementation Tasks**:
1. **Ingredient CRUD**: Add create/delete ingredient dialogs
2. **Purchase tracking**: Record purchases with supplier, cost, date
3. **Stock history**: List all ingredient transactions with filters
4. **Low-stock alerts**: Visual indicators and notification triggers

### 3.5 Tables & Stations
**Current State**: Entities and DAO exist, displayed in Live Orders tabs
**Gaps**:
- No CRUD UI for tables
- No CRUD UI for stations
- No floor plan view
- No guest management UI

**Implementation Tasks**:
1. **Table manager**: CRUD tables with name, capacity, section, floor plan position
2. **Station manager**: CRUD stations with name, type, emoji, active status
3. **Floor plan**: Visual grid showing table layout and status
4. **Guest management**: Add/remove guests, assign to tables, mood tracking

### 3.6 Analytics & Sales Overview
**Current State**: Daily sales, order count, avg order value, payment method breakdown, category breakdown
**Gaps**:
- No revenue charts (line/bar/pie)
- No time range filters (today/week/month/quarter/year)
- No top products ranking
- No customer analytics

**Implementation Tasks**:
1. **Revenue charts**: Line chart for sales over time, bar chart by category, pie chart by payment method
2. **Time filters**: Today, Week, Month, Quarter, Year, All
3. **Top products**: Ranked list by quantity sold and revenue
4. **Customer analytics**: VIP/Regular/Casual/At-Risk tiers, lifetime value, visit frequency

### 3.7 Kitchen Display
**Current State**: Not implemented
**Gaps**:
- Station-filtered view
- Order cards with items/modifiers
- Status action buttons
- Message threading

**Implementation Tasks**:
1. **Station filter**: Tabs for All/Coffee/Kitchen/Bar/Pastry/General
2. **Order cards**: Items with options, timing, customer notes
3. **Actions**: Start Preparing / Mark Ready buttons
4. **Messages**: Thread view with unanswered indicators

### 3.8 Customer & Loyalty
**Current State**: Loyalty card registration in menu, reward display
**Gaps**:
- No customer creation UI
- No voucher management
- No loyalty settings configuration
- No points adjustment

**Implementation Tasks**:
1. **Customer list**: View/search customers, add points manually
2. **Voucher management**: Create promo/reward/milestone vouchers, set rules
3. **Loyalty settings**: Global and per-category settings, milestone mode
4. **Redemption flow**: Apply vouchers at checkout, claim rewards

### 3.9 Staff & HR
**Current State**: Not implemented
**Gaps**:
- No user authentication
- No role management
- No attendance tracking
- No payroll

**Implementation Tasks**:
1. **Authentication**: Login screen, session management, role-based access
2. **Staff management**: CRUD staff, assign roles, set permissions
3. **Time tracking**: Clock in/out, break time, total hours
4. **Leave management**: Request/approve leave, leave types
5. **Payroll**: Philippine statutory deductions (SSS, PhilHealth, Pag-IBIG, withholding tax)

### 3.10 Finance
**Current State**: Not implemented
**Gaps**:
- No expense tracking
- No supplier management
- No payment transaction history

**Implementation Tasks**:
1. **Expenses**: CRUD expenses with category, supplier, amount, date
2. **Suppliers**: CRUD suppliers with contact info
3. **Payments**: Payment transaction history with method breakdown

### 3.11 Settings & Configuration
**Current State**: Export/import, version info
**Gaps**:
- No branding settings
- No business settings (BIR, VAT, receipt)
- No payment QR configuration
- No voice settings

**Implementation Tasks**:
1. **Branding**: Shop name, logo upload, theme colors
2. **Business**: BIR TIN, branch code, VAT rate, receipt prefix
3. **Payments**: GCash/PayMaya account names and QR images
4. **Voice**: Volume, speed, notification sounds

### 3.12 Media & Images
**Current State**: Images saved to internal storage, but not rendered
**Gaps**:
- No image rendering in product cards
- No image caching
- No image compression
- No review image upload

**Implementation Tasks**:
1. **Image rendering**: Add `Image` composable to all product cards using `rememberImagePainter` with file path
2. **Image cache**: Implement disk cache for loaded images
3. **Compression**: Compress images before saving to reduce storage
4. **Review images**: Allow image upload in reviews

---

## 4. Architecture Decisions

### 4.1 Data Storage
- **Products/Ingredients**: Room database (already implemented)
- **Images**: Internal files directory with file paths in DB
- **Export/Import**: JSON files in Downloads folder

### 4.2 Option Groups
- Use existing `OptionGroup`, `ProductOptionGroup`, `Option` entities
- Replace hardcoded options in POS with dynamic lookups
- Support single/multi selection types

### 4.3 Pricing
- Use existing `calculateBirPrice()` for BIR compliance
- Support PERCENTAGE and FIXED margin types
- VAT-exempt flag per product

### 4.4 Real-time
- Implement Socket.IO client for live updates
- Events: order status, inventory updates, queue changes

---

## 5. Implementation Phases

### Phase 1: Critical Bugs & Core Parity (Week 1-2)
- [x] Fix inventory add-ingredient
- [x] Fix product image storage
- [x] Fix recipe capital calculation
- [x] Fix duplicate import
- [x] Fix category deletion
- [x] Fix broken inventory query
- [x] Add image rendering to product cards
- [x] Make POS options data-driven (ProductOptionsBottomSheet uses OptionGroup/Option entities)
- [x] Add table selector to checkout
- [x] Add payment screenshot upload for GCash/PayMaya
- [x] Order confirmation dialog with barcode and print receipt
- [x] BIR receipt numbering (sequential numbers via getNextReceiptNumber)

### Phase 2: Live Orders & Kitchen (Week 3-4)
- [x] Implement Kanban board (LiveOrdersScreen with 4-column drag-and-drop)
- [x] Add order detail slide-over
- [x] Implement Kitchen Display screen (station filtering, status transitions)
- [x] Add station filtering (tab-based in KitchenScreen)
- [ ] Add message threading

### Phase 3: Product & Inventory (Week 5-6)
- [x] Build option group manager (OptionGroupScreen with CRUD)
- [x] Add product search (POSScreen with search bar)
- [x] Add ingredient deletion (AddIngredientDialog + delete)
- [x] Add purchase tracking (Record Purchase dialog, PurchasesTab)
- [x] Add stock history view (StockHistoryTab showing all transactions)
- [x] Add supplier CRUD (SupplierFormDialog, add/edit/delete)
- [x] Add option group navigation route

### Phase 4: Analytics & Finance (Week 7-8)
- [x] Build revenue charts (Canvas-based bar chart in AnalyticsScreen)
- [x] Add time range filters (TODAY/WEEK/MONTH/QUARTER/YEAR/ALL)
- [x] Add top products ranking (sorted by revenue, top 5)
- [x] Implement expense tracking (ExpensesScreen with CRUD + addExpense DAO)
- [x] Add supplier management (InventorySuppliersTab with CRUD)
- [x] Add stock movement history (StockHistoryTab, getAllTransactions)

### Phase 5: Staff, Loyalty & Settings (Week 9-10)
- [ ] Implement authentication
- [ ] Add staff management
- [ ] Add loyalty voucher management
- [x] Add settings screens (Business, Payments, Receipts tabs)
- [x] Add customer management (CustomerManagementScreen, add customer, add loyalty points)
- [x] Add BIR receipt numbering (getNextReceiptNumber, BusinessSettings entity)

### Phase 6: Polish & Sync (Week 11-12)
- [ ] Add real-time sync with Pebot
- [ ] Implement printing
- [x] Add BIR receipt numbering (BusinessSettings entity, getNextReceiptNumber)
- [ ] Performance optimization
- [ ] Testing and bug fixes

---

## 6. Acceptance Criteria

1. **All Pebot pages** have tablet equivalents with functional parity
2. **Inventory**: Staff can add/edit/delete ingredients, suppliers, record purchases, stock adjustments
3. **Products**: Full CRUD with BIR pricing, recipes, option groups, and image display
4. **Orders**: Kanban board with status changes, BIR receipt numbering, order confirmation with barcode
5. **Analytics**: Complete sales overview with charts, time filters, top products ranking
6. **Data portability**: Export/import preserves all data (expenses, business settings, option groups, images)
7. **No crashes**: All critical bugs fixed, transaction safety added
