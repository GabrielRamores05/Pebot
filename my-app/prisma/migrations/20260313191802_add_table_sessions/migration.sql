-- CreateTable
CREATE TABLE "TableSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tableId" INTEGER NOT NULL,
    "occupants" INTEGER NOT NULL,
    "entryTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exitTime" DATETIME,
    "dwellMinutes" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TableSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RestaurantTable" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "assignedOrderId" INTEGER,
    "section" TEXT NOT NULL DEFAULT 'Indoor',
    "positionX" REAL NOT NULL DEFAULT 0,
    "positionY" REAL NOT NULL DEFAULT 0,
    "occupiedSince" DATETIME,
    "currentOccupants" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_RestaurantTable" ("assignedOrderId", "capacity", "createdAt", "id", "name", "occupiedSince", "positionX", "positionY", "section", "status", "updatedAt") SELECT "assignedOrderId", "capacity", "createdAt", "id", "name", "occupiedSince", "positionX", "positionY", "section", "status", "updatedAt" FROM "RestaurantTable";
DROP TABLE "RestaurantTable";
ALTER TABLE "new_RestaurantTable" RENAME TO "RestaurantTable";
CREATE UNIQUE INDEX "RestaurantTable_name_key" ON "RestaurantTable"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
