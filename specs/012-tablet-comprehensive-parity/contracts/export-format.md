# Contract: Export/Import Format

## Overview

The tablet exports its entire database as JSON for backup and migration.
Import validates a checksum and requires admin confirmation.

## Export Format (export.json)

```jsonc
{
  "version": 1,
  "timestamp": 1234567890,
  "checksum": "sha256-hash-of-data",
  "data": {
    "products": [Product[]],
    "categories": [Category[]],
    "orders": [Order[]],
    "order_items": [OrderItem[]],
    "ingredients": [Ingredient[]],
    "ingredient_transactions": [IngredientTransaction[]],
    "suppliers": [Supplier[]],
    "product_ingredients": [ProductIngredient[]],
    "option_groups": [OptionGroup[]],
    "product_option_groups": [ProductOptionGroup[]],
    "options": [Option[]],
    "payments": [Payment[]],
    "tables": [CafeTable[]],
    "stations": [Station[]],
    "loyalty_vouchers": [LoyaltyVoucher[]],
    "staff": [Staff[]],
    "business_settings": [BusinessSettings[]],
    "expenses": [Expense[]],
    "customers": [Customer[]],
    "reviews": [Review[]],           // New
    "order_messages": [OrderMessage[]], // New
    "expense_categories": [ExpenseCategory[]], // New
    "audit_events": [AuditEvent[]],   // New
    "attendance": [Attendance[]],     // New
    "leave_requests": [LeaveRequest[]], // New
    "schedules": [Schedule[]],        // New
    "payrolls": [Payroll[]],          // New
    "staff_documents": [StaffDocument[]], // New
    "staff_trainings": [StaffTraining[]], // New
    "performance_reviews": [PerformanceReview[]], // New
    "loyalty_cards": [LoyaltyCard[]], // New
    "loyalty_transactions": [LoyaltyTransaction[]], // New
    "table_sessions": [TableSession[]], // New
    "ai_conversations": [AIConversation[]], // New
    "ai_messages": [AIMessage[]]      // New
  }
}
```

## Import Rules

1. Checksum must match — file integrity verified before import
2. Admin confirmation required (PIN entry)
3. Current database backed up before import
4. Existing records updated via `REPLACE` on conflict
5. New entities inserted
6. Missing entities in export ignored gracefully
7. Image files referenced by relative paths in internal storage

## Backward Compatibility

- Export imports from older versions must work
- New fields optional during import (null defaults)
- Schema version tracked in export JSON
