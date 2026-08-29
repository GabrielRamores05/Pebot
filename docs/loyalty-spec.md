# Loyalty System Specification

## Overview

The loyalty program tracks paid coffees and rewards customers with a free coffee
after 9 paid purchases. The system uses a single-voucher cycle model: earn,
claim, use, reset.

**Core rule:** 9 paid coffees = 1 free coffee (use on next order) = counter resets.

---

## System Model

| Aspect | Value |
|--------|-------|
| Threshold | 9 paid coffees |
| Vouchers per cycle | 1 (no stacking) |
| Counter range | 0-9 (resets after use) |
| Voucher code format | `FREE-{timestamp}-{random}` |
| Reset trigger | Voucher redeemed on an order |

---

## Customer Journey

```
Order 1  → paidCoffeesCount: 1 (8 more needed)
Order 2  → paidCoffeesCount: 2 (7 more needed)
...
Order 9  → paidCoffeesCount: 9  FREE COFFEE EARNED
           → Auto-generated FREE voucher

Menu     → "Free coffee earned! Claim it now."
         → Click "Claim 1 Free Coffee"
         → Get: FREE-xxx-yyy code

Order 10 → Use FREE-xxx-yyy voucher
           → Cost: free
           → Voucher deleted
           → paidCoffeesCount reset to 0

Order 11 → New cycle begins (paidCoffeesCount: 1)
```

---

## API Endpoints

### Get Customer Status
```
GET /api/loyalty/cards/:customerName
```
Response:
```json
{
  "customerName": "John",
  "paidCoffeesCount": 9,
  "coffeesRequiredForFree": 9,
  "coffeesUntilNextFree": 0,
  "hasFreeCoffee": true,
  "activeVouchers": 1,
  "vouchers": [{ "code": "FREE-xxx-yyy", "issuedDate": "..." }]
}
```

### Add Paid Coffee
```
POST /api/loyalty/cards/:customerName
```
Request: `{ "quantity": 1 }`

Logic: When transitioning from 8 to 9 coffees and no active free voucher
exists, auto-generate exactly 1 FREE voucher.

### Claim Free Coffee
```
POST /api/loyalty/vouchers/claim
```
Request: `{ "customerName": "John" }`

Response:
```json
{
  "claimedCount": 1,
  "voucherCodes": ["FREE-xxx-yyy"],
  "message": "Successfully claimed 1 free coffee! Use it on your next order."
}
```

### Redeem Voucher (on order)
```
POST /api/loyalty/vouchers/:code
```
Response:
```json
{
  "code": "FREE-xxx-yyy",
  "message": "Voucher successfully redeemed and removed",
  "counterReset": true
}
```

Logic: If code starts with `FREE-`, delete voucher and reset
`paidCoffeesCount` to 0.

---

## Database Models

### LoyaltySetting
```prisma
model LoyaltySetting {
  id                    Int      @id @default(autoincrement())
  coffeesRequiredForFree Int     @default(9)
  enabled               Boolean  @default(true)
  cardColor             String   @default("#d97706")
  cardTitle             String   @default("My Coffee Card")
  cardDescription       String   @default("Earn rewards with every purchase")
  rewardDescription     String   @default("Free Coffee")
  milestoneMode         String   @default("FIXED")
}
```

### LoyaltyCard
```prisma
model LoyaltyCard {
  id                Int               @id @default(autoincrement())
  customerName      String            @unique
  paidCoffeesCount  Int               @default(0)
  claimedMilestones String            @default("[]")
  vouchers          LoyaltyVoucher[]
}
```

### LoyaltyVoucher
```prisma
model LoyaltyVoucher {
  id             Int       @id @default(autoincrement())
  code           String    @unique
  customerName   String
  card           LoyaltyCard @relation(fields: [customerName], references: [customerName])
  status         String    @default("ACTIVE")
  rewardType     String    @default("Free Coffee")
  value          Float?
  issuedDate     DateTime  @default(now())
  expiryDate     DateTime?
  redeemedDate   DateTime?
  redeemedOrderId Int?
}
```

---

## Rules

- Points are earned per line item, not per order. A Latte with Size Large and
  Extra Shot counts as 1 point.
- Only 1 free voucher exists per customer at any time (no stacking).
- Counter never exceeds 9 (reset on use).
- Loyalty-promo orders earn no new points.
- Kitchen "Mark Ready" does not award points.
- If no loyalty card exists for a customer name, one is auto-created at 0.

---

## Validation Rules

| Scenario | Result |
|----------|--------|
| paidCoffeesCount < 9 | Cannot claim yet |
| paidCoffeesCount = 9 + no free voucher | Auto-generates 1 |
| paidCoffeesCount = 9 + free voucher exists | Can claim |
| Try to claim 2+ free coffees | Only 1 allowed |
| Use free coffee in order | Delete + Reset to 0 |
| paidCoffeesCount > 9 | Prevented by reset logic |

---

## UI Behavior

### Menu - Loyalty Card Panel
- Progress bar: 0-9 (fixed range)
- Green highlight when free coffee earned
- Button: "Claim 1 Free Coffee" (no quantity selector)
- Message: "Use it on your next order"

### Cart
- Green banner: "Free Rewards Applied! 1 free coffee claimed"
- Discount applied automatically
- Remove button to unapply

### Admin Dashboard
- Search customers by name
- View vouchers with status (ACTIVE/REDEEMED/EXPIRED)
- Color-coded indicators

---

## Implementation Files

| File | Changes |
|------|---------|
| `app/api/loyalty/settings/route.ts` | Default coffeesRequiredForFree: 9 |
| `app/api/loyalty/cards/[customerName]/route.ts` | Auto-generate FREE voucher at 9, transition logic (8->9) |
| `app/api/loyalty/vouchers/claim/route.ts` | Validate at 9, return 1 voucher only |
| `app/api/loyalty/vouchers/[code]/route.ts` | Auto-reset counter for FREE vouchers |
| `app/menu/page.tsx` | Progress 0-9, simplified claim UI |
| `app/cart/page.tsx` | Voucher persistence via localStorage |
