# 🎯 Loyalty System Update: 1-9 Cycle with Single Free Coffee

## Overview
The loyalty program has been updated to use a simpler, more customer-friendly model:
- **Track** coffees from **1 to 9**
- At **9 paid coffees**, customer earns **1 free coffee**
- Free coffee is **used on the next order**
- After using, the counter **resets to 0** and cycle repeats
- **No stacking** - only 1 free coffee available per cycle

---

## 📋 Implementation Changes

### 1. Settings Endpoint
**File:** `app/api/loyalty/settings/route.ts`

**Changed:**
- Default `coffeesRequiredForFree` from `10` → `9`
- Updated messaging to reflect new cycle

```typescript
// Before
coffeesRequiredForFree: 10

// After  
coffeesRequiredForFree: 9
```

**API Response:**
```json
{
  "coffeesRequiredForFree": 9,
  "message": "After 9 paid coffees, earn 1 free coffee for next order"
}
```

---

### 2. Get Loyalty Card Endpoint
**File:** `app/api/loyalty/cards/[customerName]/route.ts` (GET)

**Changes:**
- Auto-generates free coffee voucher when reaching exactly 9 coffees
- Only generates 1 voucher per cycle (no stacking)
- Returns new fields: `hasFreeCoffee`, `coffeesUntilNextFree`

**Response Fields:**
```json
{
  "customerName": "John",
  "paidCoffeesCount": 9,            // 0-9 range
  "coffeesRequiredForFree": 9,      // Threshold
  "coffeesUntilNextFree": 0,        // 0 when earned
  "hasFreeCoffee": true,             // NEW: True if free coffee available
  "activeVouchers": 1,               // Always 0 or 1
  "vouchers": [
    {
      "code": "FREE-...-...",        // Now starts with FREE-
      "issuedDate": "2026-03-12T..."
    }
  ]
}
```

**Logic:**
```typescript
// When paidCoffeesCount == 9 && no active voucher exists:
// → Automatically create 1 FREE voucher
// Code format: FREE-{timestamp}-{randomPart}
```

---

### 3. Add Coffees (POST) Endpoint
**File:** `app/api/loyalty/cards/[customerName]/route.ts` (POST)

**Changes:**
- Detect when transitioning from 8 → 9 coffees
- Auto-generate single free coffee voucher at that moment
- No multiple vouchers (unlike old system)

**Logic:**
```typescript
// Check: paidCoffeesCount was 8, will become 9
const isTransitioningTo9 = card.paidCoffeesCount === 8;

// After increment:
if (card.paidCoffeesCount === 9 && noActiveFreeVoucher) {
  createFreeVoucher();  // Only 1 per cycle
}
```

---

### 4. Voucher Redemption Endpoint
**File:** `app/api/loyalty/vouchers/[code]/route.ts` (POST)

**Changes:**
- Detects if voucher is a FREE coffee (code starts with `FREE-`)
- **Automatically resets counter to 0** when free coffee is used
- Deletes the voucher permanently

**Response:**
```json
{
  "code": "FREE-xxx-yyy",
  "message": "Voucher successfully redeemed and removed",
  "counterReset": true  // NEW: Indicates counter was reset
}
```

**Logic:**
```typescript
// Identify FREE voucher
if (code.startsWith('FREE-')) {
  // Delete voucher
  await deleteVoucher(code);
  
  // Reset customer's counter
  UPDATE LoyaltyCard 
  SET paidCoffeesCount = 0 
  WHERE customerName = ?;
  
  return { counterReset: true };
}
```

---

### 5. Claim Vouchers Endpoint
**File:** `app/api/loyalty/vouchers/claim/route.ts` (POST)

**Changes:**
- Updated to require exactly 9 paid coffees (not variable quantity)
- Only allows claiming 1 free coffee at a time
- Clear error messages about requirements

**Request:**
```json
{
  "customerName": "John"
  // quantity parameter ignored - always 1
}
```

**Validation:**
```typescript
// Error if paidCoffeesCount < 9
❌ "You need X more coffee(s) to earn a free one"

// Error if no free voucher exists
❌ "No free coffee available right now"

// Success if at 9 and voucher exists
✓ Returns 1 FREE-xxx-yyy code
```

**Response:**
```json
{
  "customerName": "John",
  "claimedCount": 1,
  "voucherCodes": ["FREE-xxx-yyy"],
  "message": "Successfully claimed 1 free coffee! Use it on your next order."
}
```

---

## 🎨 UI Changes

### Menu - Loyalty Card Panel

**Before:**
- Progress: 0-10+, multiple free vouchers possible  
- Button: "Claim N Free Coffee Vouchers"
- Complex quantity selector

**After:**
- Progress: **0-9** (fixed range)
- Display: Green highlight when free coffee earned
- Message: "✓ Free coffee earned! Claim it now."
- Button: "🎁 Claim 1 Free Coffee" (always 1)
- Simple claim flow without quantity selection

**File:** `app/menu/page.tsx`

**Changes:**
```typescript
// OLD
<p>{card.coffeesUntilNextVoucher} more to earn a free coffee</p>
<p>{card.totalEarned} vouchers earned</p>

// NEW
<p>{card.coffeesUntilNextFree} more coffee until free</p>
<p className={card.hasFreeCoffee ? 'bg-green-100' : 'bg-stone-100'}>
  {card.activeVouchers} Free Coffees
</p>
```

**Claim Panel:**
```typescript
// Simplified - no quantity selector
// Just: "Claim 1 Free Coffee" button
// Shows: "Use it on your next order" message
```

---

## 🔄 Complete Customer Journey

### Cycle 1
```
Order 1 → paidCoffeesCount: 1 (8 more needed)
Order 2 → paidCoffeesCount: 2 (7 more needed)
...
Order 8 → paidCoffeesCount: 8 (1 more needed)
Order 9 → paidCoffeesCount: 9 ✅ FREE COFFEE EARNED
         → Free voucher auto-generated
         
Menu → "✓ Free coffee earned! Claim it now."
     → Click "Claim 1 Free Coffee"
     → Get: FREE-xxx-yyy code
     
Order 10 → Use FREE-xxx-yyy voucher
        → Cost: free
        → Voucher deleted
        → paidCoffeesCount reset to 0 ✅
```

### Cycle 2 (Restarts)
```
Order 11 → paidCoffeesCount: 1 (8 more needed)
...
Order 19 → paidCoffeesCount: 9 ✅ FREE COFFEE EARNED (again)
```

---

## 📊 Database Behavior

### LoyaltyVoucher
- **Code Format**: `FREE-{timestamp}-{random}` (distinctive marker)
- **Status**: `ACTIVE` until used, then **deleted**
- **Quantity**: Max 1 per customer at any time
- **Lifespan**: Created at 9 coffees → Claimed → Used → Deleted

### LoyaltyCard
- **paidCoffeesCount**: 
  - Range: 0-9 (displayed to customer)
  - Increments on paid orders
  - Resets to 0 when free coffee used
  - Never goes beyond 9 (counter reset prevents it)

---

## ✅ Validation & Rules

| Scenario | Result |
|----------|--------|
| paidCoffeesCount < 9 | ❌ Can't claim yet |
| paidCoffeesCount = 9 + no free voucher | ✅ Auto-generates 1 |
| paidCoffeesCount = 9 + free voucher exists | ✅ Can claim |
| Try to claim 2+ free coffees | ❌ Only 1 allowed |
| Use free coffee in order | ✅ Delete + Reset to 0 |
| paidCoffeesCount > 9 | ❌ Prevented by reset logic |

---

## 🧪 Test Coverage

Test file: `test-new-loyalty-cycle.js`

**Scenarios Tested:**
1. ✓ Register customer
2. ✓ Add coffees 1-8 (no free generated)
3. ✓ Add 9th coffee (free generated automatically)
4. ✓ Verify only 1 free exists (no stacking)
5. ✓ Card shows 0-9 progress
6. ✓ Claim the free coffee
7. ✓ Use in order
8. ✓ Counter resets to 0
9. ✓ New cycle begins
10. ✓ Progress bar calculation accurate

---

## 🔐 Data Integrity

**Prevention of Issues:**
- ✅ Only 1 free coffee generated per cycle
- ✅ Counter auto-reset prevents > 9
- ✅ Voucher auto-deletion prevents reuse
- ✅ No stacking via existingFreeCount check
- ✅ Transition-based generation (8→9) prevents double-creation

---

## 📝 API Summary

### Updated Endpoints

| Endpoint | Method | Changes |
|----------|--------|---------|
| `/api/loyalty/settings` | GET | coffeesRequiredForFree: 10→9 |
| `/api/loyalty/cards/:customerName` | GET | Auto-generates FREE voucher @9 |
| `/api/loyalty/cards/:customerName` | POST | Single voucher generation logic |
| `/api/loyalty/vouchers/claim` | POST | Updated validation, 1 voucher only |
| `/api/loyalty/vouchers/:code` | POST | Auto-resets counter for FREE vouchers |

### Not Changed
- `/api/loyalty/register` - Still creates card at 0
- `/api/orders` - Still accepts loyaltyVoucherCodes array
- All redemption logic remains similar

---

## 💡 Benefits of New System

1. **Simpler for Customers**
   - Easy to understand: "9 paid = 1 free"
   - Visible 0-9 progress (always know where they are)
   - One free coffee at a time (no confusion)

2. **Simpler for Staff**
   - No tracking multiple vouchers per customer
   - Clear lifecycle: earn → claim → use → reset

3. **Better Business Model**
   - Predictable free coffee distribution
   - No accumulation (customers must use or lose)
   - Encourages return visits to use free coffee

4. **Cleaner Implementation**
   - Single voucher per cycle eliminates edge cases
   - Auto-reset prevents complexity
   - Easier to debug and maintain

---

## 🚀 Deployment Notes

1. **Database**: No schema changes needed
   - Uses existing `LoyaltyCard` and `LoyaltyVoucher` models
   - Only behavior changes (threshold + auto-generate logic)

2. **Backward Compatibility**:
   - Old vouchers (if any exist) will still work
   - New system doesn't affect existing data

3. **Existing Customers**:
   - paidCoffeesCount preserved as-is
   - If at 9+, will auto-generate free coffee on next card fetch
   - Normal flow continues

---

## 📞 Summary

The loyalty system has been completely redesigned for simplicity:
- **9 paid coffees → 1 free coffee** (clear threshold)
- **Must use on next order** (no stacking)
- **Counter resets after use** (clean cycles)
- **Display range 0-9** (customer sees progress)
- **Auto-generation & reset** (no manual intervention)

This creates a predictable, customer-friendly loyalty program that encourages repeat visits and is easy to understand and use.
