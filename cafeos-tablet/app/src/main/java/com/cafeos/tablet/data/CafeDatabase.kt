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
        IngredientTransaction::class
    ],
    version = 1,
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
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}
