# Spec 012: Tablet Comprehensive Feature Parity Roadmap

## Objective

Achieve **feature parity** between the Pebot Windows system (`my-app/`) and the
Android tablet app (`cafeos-tablet/`), excluding the **Customer Menu** (`/menu`)
which is intentionally a customer-facing QR channel not replicated on staff
tablets.

The tablet serves as the **staff/kitchen/admin terminal**: POS ordering, live
orders, kitchen display, inventory, products, analytics, finance, staff/HR,
settings, and real-time sync. Every module in the Windows admin section (`/admin/*`)
must have a tablet equivalent with equivalent data models and business rules.

## Windows Feature Baseline (Admin/Staf Modules)

### Windows Modules to Replicate

| # | Module | Routes | Key Features |
|---|--------|--------|-------------|
| 1 | POS Terminal | `/admin/terminal` | Order creation, cart, options, discounts, table assignment, payment |
| 2 | Live Orders | `/admin` | Kanban board, drag-and-drop, order details, invoice viewer |
| 3 | Product Mgmt | `/admin/products` | CRUD, categories, BIR pricing, option groups, recipes, images, reviews |
| 4 | Inventory | `/admin/inventory` | Stock levels, ingredients, suppliers, capacity, purchases, adjustments |
| 5 | Stock History | `/admin/stock-history` | Transaction history with filters |
| 6 | Expenses | `/admin/expenses` | CRUD expenses, categories, supplier linking |
| 7 | Revenue | `/admin/revenue` | Charts, time filters, payment/categorical breakdowns, top products |
| 8 | Customers | `/admin/customers` | Analytics, tiers, LTV, visit frequency, churn |
| 9 | Loyalty | `/admin/loyalty` | Card CRUD, vouchers, settings, rewards, milestones |
| 10 | Staff/HR | `/admin/staff` | Team, schedule, time clock, leave, payroll, performance, docs, training |
| 11 | Tables | `/admin/tables` | CRUD, floor plan, sections, capacity, status |
| 12 | Stations | `/admin/stations` | Kitchen station config |
| 13 | Kitchen Display | `/kitchen` | Station-filtered, status transitions, messages |
| 14 | Order History | `/admin/order-history` | Filterable history |
| 15 | Reviews | `/admin/reviews` | Product reviews management |
| 16 | Audit Logs | `/admin/audit-logs` | Append-only event viewer |
| 17 | Settings | `/admin/settings` | Branding, business, loyalty, payments, voice, users, admin tools |
| 18 | AI Consultant | `/admin/consultant` | Chat with context about orders/inventory/sales |
| 19 | Analytics | `/admin/analytics` | Overview, Revenue, Customers, Fulfillment, Vouchers tabs |

### Windows Excluded (Not on Tablet)

| Module | Reason |
|--------|--------|
| Customer Menu | `/menu` — customer-facing QR ordering, intentionally not on staff tablet |

### Windows Data Models (Prisma Schema)

Key entities that must exist on the tablet (mapped to existing Room entities
or new ones to create):

| Windows Entity | Tablet Entity | Status |
|----------------|---------------|--------|
| User | Staff (exists) | ✅ |
| Category | Category (exists) | ✅ |
| Product | Product (exists) | ✅ |
| Review | Review | ❌ New |
| Ingredient | Ingredient (exists) | ✅ |
| IngredientTransaction | IngredientTransaction (exists) | ✅ |
| Supplier | Supplier (exists) | ✅ |
| ProductIngredient | ProductIngredient (exists) | ✅ |
| OptionGroup | OptionGroup (exists) | ✅ |
| ProductOptionGroup | ProductOptionGroup (exists) | ✅ |
| Option | Option (exists) | ✅ |
| ProductOption | ProductOption | ❌ New |
| RestaurantTable | CafeTable (exists) | ✅ |
| TableSession | TableSession | ❌ New |
| Order | Order (exists) | ✅ |
| OrderItem | OrderItem (exists) | ✅ |
| OrderMessage | OrderMessage | ❌ New |
| PaymentTransaction | Payment (exists) | ✅ |
| LoyaltyCard | LoyaltyCard | ❌ New |
| LoyaltyTransaction | LoyaltyTransaction | ❌ New |
| LoyaltyVoucher | LoyaltyVoucher (exists) | ✅ |
| LoyaltySetting | LoyaltySetting | ❌ New |
| Attendance | Attendance | ❌ New |
| LeaveRequest | LeaveRequest | ❌ New |
| Schedule | Schedule | ❌ New |
| Payroll | Payroll | ❌ New |
| Expense | Expense (exists) | ✅ |
| ExpenseCategory | ExpenseCategory | ❌ New |
| BusinessSettings | BusinessSettings (exists) | ✅ |
| AuditEvent | AuditEvent | ❌ New |
| AIConversation | AIConversation | ❌ New |
| AIMessage | AIMessage | ❌ New |
| StaffDocument | StaffDocument | ❌ New |
| StaffTraining | StaffTraining | ❌ New |
| PerformanceReview | PerformanceReview | ❌ New |

## Constitution Alignment

### Principle I: Local-first, offline-always
- Tablet uses Room (SQLite) as source of truth — no internet required ✅
- Socket.IO sync (added) is event-based, not blocking — offline mode continues
- **Requirement**: All operations must work without network; sync queues changes

### Principle II: Two trust zones
- Staff authentication via PIN on tablet; role-based navigation
- Socket.IO connections must carry same auth as HTTP routes
- **Requirement**: Tablet auth mirrors web session roles (ADMIN, MANAGER, STAFF, KITCHEN, BARISTA)

### Principle III: Money and records are append-only
- Order totals computed server-side (on tablet) from line items ✅ (tablet is the server)
- Receipts sequential and immutable — `getNextReceiptNumber()` per Order ✅
- **Requirement**: No UPDATE/DELETE on finalized orders/payments; corrections via reversal

### Principle IV: Thin routes, domain modules
- Tablet ViewModel calls DAO directly (no "routes" in Android architecture)
- **Requirement**: All `dao.*` calls remain in repository/DAO layer, not in UI

### Principle V: Electron is a shell
- Tablet is native Android, not Electron — web app independence is preserved

### Principle VI: Tests are the deliverable
- **Requirement**: New tablet features require unit tests in `app/src/test/java/`

### Principle VII: No silent data loss
- **Requirement**: Export must include all new data models; import validates checksums
- Restore/export requires admin confirmation per constitution

## Acceptance Criteria

1. Every Windows admin module has a tablet screen with equivalent CRUD
2. All shared data models match between web and tablet schemas
3. Order lifecycle (PENDING → PREPARING → COMPLETED/CANCELLED) works identically
4. BIR receipt numbering is sequential and immutable on both platforms
5. Inventory deductions on order completion use recipe linkage (ProductIngredient)
6. Staff roles/permissions enforced in tablet navigation and Socket.IO sync
7. Export/import preserves all data including new entities
8. Offline-first: all operations work without network; sync reconciles on reconnect
9. Unit tests cover all new ViewModel/DAO logic

## Exclusions

- Customer menu (`/` and `/menu`) — intentionally not replicated (customer-facing)
- Real-time customer-facing order tracking — tablet receives updates but doesn't
  serve customer views (customers use their own phones)
