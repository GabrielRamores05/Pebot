package com.cafeos.tablet.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [
        Category::class,
        Product::class,
        Order::class,
        OrderItem::class,
        Ingredient::class,
        IngredientTransaction::class,
        OrderOption::class,
        Payment::class,
        SyncMeta::class,
        Customer::class,
        Supplier::class,
        CafeTable::class,
        Station::class,
        ProductIngredient::class,
        OptionGroup::class,
        ProductOptionGroup::class,
        Option::class,
        Expense::class,
        ExpenseCategory::class,
        BusinessSettings::class,
        Staff::class,
        LoyaltyVoucher::class,
        OrderMessage::class,
        Review::class,
        AuditEvent::class,
        Attendance::class,
        LeaveType::class,
        LeaveRequest::class,
        Schedule::class,
        Payroll::class,
        StaffDocument::class,
        StaffTraining::class,
        PerformanceReview::class,
        ProductOption::class,
        TableSession::class,
        LoyaltyCard::class,
        LoyaltyTransaction::class,
        LoyaltySetting::class,
        AIConversation::class,
        AIMessage::class,
        Guest::class,
        TableSection::class,
        ProductStation::class,
        SupplierIngredientPrice::class,
        OutboxEntry::class
    ],
    version = 20,
    exportSchema = false
)
abstract class CafeDatabase : RoomDatabase() {
    abstract fun cafeDao(): CafeDao

    companion object {
        @Volatile
        private var INSTANCE: CafeDatabase? = null

        /**
         * v17 -> v18 (spec 013, Phase 0): field parity batch with the Windows
         * Prisma schema — Orders (deliveryAddress/notes/loyaltyCustomerName/
         * loyaltyPromo/queueNumber/updatedAt + unique orderNumber), Payment
         * (amount), OrderMessage (type text|voice), BusinessSettings
         * (footer/loyaltyEnabled/studentPwdDiscountRate/AI block),
         * Staff (HR profile fields), Review (customerName/tasteSuggestion/
         * imageUrl), CafeTable (slug/updatedAt), Expense (categoryId),
         * IngredientTransaction (referenceId/referenceType).
         *
         * Column additions are all nullable or carry a DEFAULT so every ALTER is
         * a metadata-only change; no table rebuilds are required.
         */
        private val MIGRATION_17_18 = object : Migration(17, 18) {
            override fun migrate(db: SupportSQLiteDatabase) {
                // Orders
                db.execSQL("ALTER TABLE Orders ADD COLUMN deliveryAddress TEXT")
                db.execSQL("ALTER TABLE Orders ADD COLUMN notes TEXT")
                db.execSQL("ALTER TABLE Orders ADD COLUMN loyaltyCustomerName TEXT")
                db.execSQL("ALTER TABLE Orders ADD COLUMN loyaltyPromo INTEGER NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE Orders ADD COLUMN queueNumber INTEGER")
                db.execSQL("ALTER TABLE Orders ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0")
                db.execSQL("CREATE UNIQUE INDEX IF NOT EXISTS index_Orders_orderNumber ON Orders(orderNumber)")
                // Payment
                db.execSQL("ALTER TABLE Payment ADD COLUMN amount REAL NOT NULL DEFAULT 0")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_Payment_orderId ON Payment(orderId)")
                // OrderMessage
                db.execSQL("ALTER TABLE OrderMessage ADD COLUMN type TEXT NOT NULL DEFAULT 'text'")
                // BusinessSettings
                db.execSQL("ALTER TABLE BusinessSettings ADD COLUMN footerMessage TEXT NOT NULL DEFAULT 'Thank you for your visit!'")
                db.execSQL("ALTER TABLE BusinessSettings ADD COLUMN loyaltyEnabled INTEGER NOT NULL DEFAULT 1")
                db.execSQL("ALTER TABLE BusinessSettings ADD COLUMN studentPwdDiscountRate REAL NOT NULL DEFAULT 20")
                db.execSQL("ALTER TABLE BusinessSettings ADD COLUMN aiApiKey TEXT")
                db.execSQL("ALTER TABLE BusinessSettings ADD COLUMN aiModel TEXT")
                db.execSQL("ALTER TABLE BusinessSettings ADD COLUMN aiSystemPrompt TEXT")
                db.execSQL("ALTER TABLE BusinessSettings ADD COLUMN aiFolderAccess INTEGER NOT NULL DEFAULT 0")
                db.execSQL("ALTER TABLE BusinessSettings ADD COLUMN aiReadBirPricing INTEGER NOT NULL DEFAULT 0")
                // Staff (Windows User HR profile parity)
                db.execSQL("ALTER TABLE Staff ADD COLUMN address TEXT")
                db.execSQL("ALTER TABLE Staff ADD COLUMN dateOfBirth INTEGER")
                db.execSQL("ALTER TABLE Staff ADD COLUMN hireDate INTEGER")
                db.execSQL("ALTER TABLE Staff ADD COLUMN position TEXT")
                db.execSQL("ALTER TABLE Staff ADD COLUMN department TEXT")
                db.execSQL("ALTER TABLE Staff ADD COLUMN profilePhoto TEXT")
                db.execSQL("ALTER TABLE Staff ADD COLUMN emergencyContactName TEXT")
                db.execSQL("ALTER TABLE Staff ADD COLUMN emergencyContactPhone TEXT")
                db.execSQL("ALTER TABLE Staff ADD COLUMN hourlyRate REAL")
                db.execSQL("ALTER TABLE Staff ADD COLUMN monthlySalary REAL")
                db.execSQL("ALTER TABLE Staff ADD COLUMN paymentType TEXT")
                db.execSQL("ALTER TABLE Staff ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0")
                // Review
                db.execSQL("ALTER TABLE Review ADD COLUMN customerName TEXT")
                db.execSQL("ALTER TABLE Review ADD COLUMN tasteSuggestion TEXT")
                db.execSQL("ALTER TABLE Review ADD COLUMN imageUrl TEXT")
                // CafeTable
                db.execSQL("ALTER TABLE CafeTable ADD COLUMN slug TEXT")
                db.execSQL("ALTER TABLE CafeTable ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0")
                // Expense
                db.execSQL("ALTER TABLE Expense ADD COLUMN categoryId INTEGER")
                // IngredientTransaction
                db.execSQL("ALTER TABLE IngredientTransaction ADD COLUMN referenceId INTEGER")
                db.execSQL("ALTER TABLE IngredientTransaction ADD COLUMN referenceType TEXT")
            }
        }

        /**
         * v18 -> v19 (spec 013, Phase 2): OutboxQueue — durable outbound queue for
         * actions the tablet must push to the PC ledger once it is reachable.
         */
        private val MIGRATION_18_19 = object : Migration(18, 19) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `OutboxQueue` (" +
                        "`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                        "`eventType` TEXT NOT NULL, " +
                        "`entityKey` TEXT NOT NULL, " +
                        "`payloadJson` TEXT NOT NULL, " +
                        "`state` TEXT NOT NULL, " +
                        "`attempts` INTEGER NOT NULL, " +
                        "`lastError` TEXT, " +
                        "`createdAt` INTEGER NOT NULL, " +
                        "`updatedAt` INTEGER NOT NULL)"
                )
                db.execSQL("CREATE INDEX IF NOT EXISTS index_OutboxQueue_state ON OutboxQueue(state)")
                db.execSQL("CREATE INDEX IF NOT EXISTS index_OutboxQueue_createdAt ON OutboxQueue(createdAt)")
            }
        }

        /**
         * v19 -> v20 (spec 014): Ingredient.lastSupplierId (latest supplier
         * cache) and IngredientTransaction purchase-detail columns
         * (purchaseUnit/purchaseCost/unitCost) so purchase history and price
         * trends can be shown from the append-only ledger on the tablet, mirroring
         * the Windows Prisma model. All metadata-only ALTERs — no table rebuilds.
         */
        private val MIGRATION_19_20 = object : Migration(19, 20) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE Ingredient ADD COLUMN lastSupplierId INTEGER")
                db.execSQL("ALTER TABLE IngredientTransaction ADD COLUMN purchaseUnit TEXT")
                db.execSQL("ALTER TABLE IngredientTransaction ADD COLUMN purchaseCost REAL")
                db.execSQL("ALTER TABLE IngredientTransaction ADD COLUMN unitCost REAL")
            }
        }

        fun getDatabase(context: Context): CafeDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    CafeDatabase::class.java,
                    "pebot_database"
                )
                // Real migrations for every versioned change going forward.
                .addMigrations(MIGRATION_17_18, MIGRATION_18_19, MIGRATION_19_20)
                // Legacy fallback: builds before v17 had no migration history and
                // destructive upgrades were the established behavior; keeping the
                // fallback until the v17 baseline is in the field lets old alpha
                // installs upgrade instead of crashing on open. Spec 013 Phase 10
                // removes this once all in-field devices are on >= v17.
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
