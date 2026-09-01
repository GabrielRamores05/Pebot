package com.cafeos.tablet.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

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
        BusinessSettings::class,
        Staff::class,
        LoyaltyVoucher::class
    ],
    version = 7,
    exportSchema = false
)
abstract class CafeDatabase : RoomDatabase() {
    abstract fun cafeDao(): CafeDao

    companion object {
        @Volatile
        private var INSTANCE: CafeDatabase? = null

        fun getDatabase(context: Context): CafeDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    CafeDatabase::class.java,
                    "cafeos_database"
                )
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
