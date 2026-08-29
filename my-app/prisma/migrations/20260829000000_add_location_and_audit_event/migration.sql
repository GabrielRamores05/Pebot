-- CreateTable
CREATE TABLE "Location" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- InsertDefaultLocation
INSERT INTO "Location" ("id", "name", "isActive", "createdAt", "updatedAt")
VALUES (1, 'Main', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Add locationId to all business tables (DEFAULT 1 for existing rows)
ALTER TABLE "Category" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Product" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Review" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Ingredient" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "IngredientTransaction" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Supplier" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "OptionGroup" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ProductOption" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Order" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RestaurantTable" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TableSession" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "LoyaltySetting" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "LoyaltyCard" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "LoyaltyTransaction" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "LoyaltyVoucher" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RewardHistory" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ExpenseCategory" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Expense" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "StaffStationControl" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Shift" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Schedule" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Attendance" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "LeaveType" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "LeaveRequest" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Payroll" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PerformanceReview" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "StaffDocument" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Training" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "StaffTraining" ADD COLUMN "locationId" INTEGER NOT NULL DEFAULT 1;

-- Rename AuditLog to AuditEvent (SQLite: create new, copy, drop old)
CREATE TABLE "AuditEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" INTEGER,
    "details" TEXT,
    "ip" TEXT,
    "locationId" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Copy data from AuditLog to AuditEvent
INSERT INTO "AuditEvent" ("id", "userId", "action", "resource", "resourceId", "details", "ip", "locationId", "createdAt")
SELECT "id", "userId", "action", "resource", "resourceId", "details", "ip", 1, "createdAt" FROM "AuditLog";

-- Drop old AuditLog table
DROP TABLE "AuditLog";

-- CreateIndex
CREATE INDEX "Category_locationId_idx" ON "Category"("locationId");
CREATE INDEX "Product_locationId_idx" ON "Product"("locationId");
CREATE INDEX "Review_locationId_idx" ON "Review"("locationId");
CREATE INDEX "Ingredient_locationId_idx" ON "Ingredient"("locationId");
CREATE INDEX "IngredientTransaction_locationId_idx" ON "IngredientTransaction"("locationId");
CREATE INDEX "Supplier_locationId_idx" ON "Supplier"("locationId");
CREATE INDEX "OptionGroup_locationId_idx" ON "OptionGroup"("locationId");
CREATE INDEX "ProductOption_locationId_idx" ON "ProductOption"("locationId");
CREATE INDEX "Order_locationId_idx" ON "Order"("locationId");
CREATE INDEX "RestaurantTable_locationId_idx" ON "RestaurantTable"("locationId");
CREATE INDEX "TableSession_locationId_idx" ON "TableSession"("locationId");
CREATE INDEX "LoyaltySetting_locationId_idx" ON "LoyaltySetting"("locationId");
CREATE INDEX "LoyaltyCard_locationId_idx" ON "LoyaltyCard"("locationId");
CREATE INDEX "LoyaltyTransaction_locationId_idx" ON "LoyaltyTransaction"("locationId");
CREATE INDEX "LoyaltyVoucher_locationId_idx" ON "LoyaltyVoucher"("locationId");
CREATE INDEX "RewardHistory_locationId_idx" ON "RewardHistory"("locationId");
CREATE INDEX "ExpenseCategory_locationId_idx" ON "ExpenseCategory"("locationId");
CREATE INDEX "Expense_locationId_idx" ON "Expense"("locationId");
CREATE INDEX "StaffStationControl_locationId_idx" ON "StaffStationControl"("locationId");
CREATE INDEX "Shift_locationId_idx" ON "Shift"("locationId");
CREATE INDEX "Schedule_locationId_idx" ON "Schedule"("locationId");
CREATE INDEX "Attendance_locationId_idx" ON "Attendance"("locationId");
CREATE INDEX "LeaveType_locationId_idx" ON "LeaveType"("locationId");
CREATE INDEX "LeaveRequest_locationId_idx" ON "LeaveRequest"("locationId");
CREATE INDEX "Payroll_locationId_idx" ON "Payroll"("locationId");
CREATE INDEX "PerformanceReview_locationId_idx" ON "PerformanceReview"("locationId");
CREATE INDEX "StaffDocument_locationId_idx" ON "StaffDocument"("locationId");
CREATE INDEX "Training_locationId_idx" ON "Training"("locationId");
CREATE INDEX "StaffTraining_locationId_idx" ON "StaffTraining"("locationId");
CREATE INDEX "AuditEvent_locationId_idx" ON "AuditEvent"("locationId");
