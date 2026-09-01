# Data Model Alignment

## Current Tablet Entities (Room)

```kotlin
@Entity(tableName = "Product")           // ✅ matches Windows Product
@Entity(tableName = "Category")          // ✅ matches Windows Category
@Entity(tableName = "Order")             // ✅ matches Windows Order
@Entity(tableName = "OrderItem")         // ✅ matches Windows OrderItem
@Entity(tableName = "Ingredient")        // ✅ matches Windows Ingredient
@Entity(tableName = "IngredientTransaction") // ✅ matches Windows
@Entity(tableName = "Supplier")          // ✅ matches Windows Supplier
@Entity(tableName = "ProductIngredient") // ✅ matches Windows
@Entity(tableName = "OptionGroup")       // ✅ matches Windows OptionGroup
@Entity(tableName = "ProductOptionGroup") // ✅ matches Windows
@Entity(tableName = "Option")            // ✅ matches Windows Option
@Entity(tableName = "Payment")           // ✅ matches Windows PaymentTransaction
@Entity(tableName = "CafeTable")         // ✅ matches Windows RestaurantTable
@Entity(tableName = "Station")           // ✅ matches Windows Station
@Entity(tableName = "LoyaltyVoucher")    // ✅ matches Windows LoyaltyVoucher
@Entity(tableName = "Staff")             // ✅ matches Windows User (staff roles)
@Entity(tableName = "BusinessSettings")  // ✅ matches Windows BusinessSettings
@Entity(tableName = "Expense")           // ✅ matches Windows Expense
@Entity(tableName = "Customer")          // ✅ matches Windows Customer
```

## Entities to Create

### Phase 1 Priority (High Business Impact)

| Entity | Fields | Relations |
|--------|--------|-----------|
| **Review** | id, productId, customerId, rating (1-5), comment, createdAt | Product(1):Review(N), Customer(0):Review(N) |
| **OrderMessage** | id, orderId, text, senderType, isRead, createdAt | Order(1):OrderMessage(N) |
| **ProductOption** | id, productId, optionId, priceDelta | Product(N):ProductOption(N), Option(N):ProductOption(N) |
| **TableSession** | id, tableId, orderId, startedAt, endedAt, status | CafeTable(1):TableSession(N), Order(0):TableSession |
| **ExpenseCategory** | id, name, color, icon, createdAt | ExpenseCategory(1):Expense(N) |
| **AuditEvent** | id, eventType, entityType, entityId, userId, details, createdAt | User(N):AuditEvent(N) — append-only |

### Phase 2 Priority (HR Module)

| Entity | Fields | Relations |
|--------|--------|-----------|
| **Attendance** | id, staffId, clockIn, clockOut, breakStart, breakEnd, date | Staff(1):Attendance(N) |
| **LeaveRequest** | id, staffId, type, startDate, endDate, status, reason | Staff(1):LeaveRequest(N) |
| **LeaveType** | id, name, requiresFile | LeaveType(1):LeaveRequest(N) |
| **Schedule** | id, staffId, dayOfWeek, shiftStart, shiftEnd, role | Staff(1):Schedule(N) |
| **Payroll** | id, staffId, periodStart, periodEnd, baseSalary, deductions, netPay, status | Staff(1):Payroll(N) |
| **StaffDocument** | id, staffId, title, fileUri, fileType, uploadedAt | Staff(1):StaffDocument(N) |
| **StaffTraining** | id, staffId, program, completed, certifiedAt | Staff(1):StaffTraining(N) |
| **PerformanceReview** | id, staffId, reviewerId, score, comments, date | Staff(1):PerformanceReview(N), Staff(0):PerformanceReview(N) as reviewer |

### Phase 3 Priority (Loyalty & AI)

| Entity | Fields | Relations |
|--------|--------|-----------|
| **LoyaltyCard** | id, customerId, cardNumber, pointsBalance, tier, createdAt | Customer(0):LoyaltyCard(N) |
| **LoyaltyTransaction** | id, cardId, type, points, orderId, createdAt | LoyaltyCard(1):LoyaltyTransaction(N), Order(0):LoyaltyTransaction(N) |
| **LoyaltySetting** | id, key, value, scope | singleton |
| **AIConversation** | id, title, createdAt, updatedAt | AIConversation(1):AIMessage(N) |
| **AIMessage** | id, conversationId, role, content, timestamp | AIConversation(N):AIMessage(N) |

## Schema Version

Current tablet DB: version 6 (CafeDatabase.kt)
Required after new entities: version 7+

Migration:
```kotlin
// In CafeDatabase.kt, bump version and add auto-migration
@Database(entities = [...new...], version = 7, autoMigrations = [...])
```

## Export/Import Compatibility

New entities must be added to `ExportData` serial in CafeViewModel for
round-trip export/import. The export JSON structure must remain backward
compatible — new fields optional during import.
