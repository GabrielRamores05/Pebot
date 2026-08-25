-- CreateTable
CREATE TABLE "TableGuest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tableId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "displayName" TEXT NOT NULL,
    "moodEmoji" TEXT,
    "moodNote" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "exitedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TableGuest_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TableGuest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TableSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
