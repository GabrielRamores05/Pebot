# ⚡ Loyalty System - Quick Reference Guide

## The Simple Rule
```
9 paid coffees = 1 free coffee (use next order) = counter resets
```

---

## Customer Perspective

### What They See
```
Your Loyalty Card
☕ 7 / 9

Progress: ▓▓▓▓▓▓▓░░░░ 77%

You need 2 more coffees for a free one!

Paid Coffees: 7
Free Coffees: 0
```

### When They Earn Free Coffee
```
Your Loyalty Card  
☕ 9 / 9

Progress: ▓▓▓▓▓▓▓▓▓▓ 100%

✓ Free coffee earned! Claim it now.

Paid Coffees: 9
Free Coffees: 1 (green highlight)

[🎁 Claim 1 Free Coffee] ← New button
```

### After Claiming
```
Your Loyalty Card
Menu close, redirect to Cart

Cart shows:
🎁 Free Rewards Applied!
   1 free coffee claimed
   
Order Total: €0 (free coffee applied)

[Use Free Reward] or [x Remove]
```

### After Using Free Coffee
```
Order Confirmed!
Coffee: 1x Cappuccino (FREE)
Total: €0

Your Loyalty Progress Reset!
☕ 0 / 9

Next cycle begins...
```

---

## Staff Perspective

### What to Know
- Customer tracks 0-9 coffees (visible on receipt/menu)
- At 9: free coffee automatically earned (no action needed)
- Customer can see and claim it from menu
- Only 1 free coffee at a time (no stacking)
- When used: counter resets to 0
- Cycle repeats from 0

### Troubleshooting
| Issue | Cause | Fix |
|-------|-------|-----|
| "Why only 9?" | New simpler system | Just explain: 9 paid = 1 free |
| "Where's my old vouchers?" | System reset | Still work; new vouchers emerge |
| "Counter didn't reset" | Voucher not redeemed | Ensure voucher code used at order |
| "2 free coffees?" | New free earned before using old | Use old first, then new appears |

---

## API Quick Reference

### 1. Get Customer Status
```bash
GET /api/loyalty/cards/john

Response:
{
  "paidCoffeesCount": 9,
  "coffeesUntilNextFree": 0,
  "hasFreeCoffee": true,
  "activeVouchers": 1,
  "vouchers": [{"code": "FREE-xxx-yyy"}]
}
```

### 2. Add a Paid Coffee
```bash
POST /api/loyalty/cards/john
{
  "quantity": 1
}

Response:
{
  "paidCoffeesCount": 9,
  "activeVouchers": 1  ← Auto-generated!
}
```

### 3. Claim Free Coffee
```bash
POST /api/loyalty/vouchers/claim
{
  "customerName": "john"
}

Response:
{
  "claimedCount": 1,
  "voucherCodes": ["FREE-xxx-yyy"]
}
```

### 4. Use Free Coffee
```bash
POST /api/orders
{
  "customerName": "john",
  "items": [...],
  "loyaltyVoucherCodes": ["FREE-xxx-yyy"],
  "loyaltyDiscount": 4.50
}

Response:
{
  "orderNumber": "...",
  "totalAmount": 0
}

Then redeem:
POST /api/loyalty/vouchers/FREE-xxx-yyy
{
  "orderId": 123
}

Response:
{
  "counterReset": true  ← Counter now 0!
}
```

---

## Code Changes at a Glance

### Files Modified: 5

1. **Settings** (`app/api/loyalty/settings/route.ts`)
   - Changed: 10 → 9

2. **Card GET** (`app/api/loyalty/cards/[customerName]/route.ts`)
   - Added: Auto-generate FREE voucher at 9
   - Changed: Field names (coffeesUntilNextFree, hasFreeCoffee)

3. **Card POST** (`app/api/loyalty/cards/[customerName]/route.ts`)
   - Added: Transition logic (8→9 detection)
   - Changed: Only 1 voucher generation

4. **Voucher Claim** (`app/api/loyalty/vouchers/claim/route.ts`)
   - Changed: Validate exactly at 9, return 1 voucher

5. **Voucher Redeem** (`app/api/loyalty/vouchers/[code]/route.ts`)
   - Added: Auto-reset counter for FREE vouchers

6. **Menu UI** (`app/menu/page.tsx`)
   - Changed: Progress 0-9, removed quantity selector
   - Added: Green highlight for hasFreeCoffee
   - Changed: Button text "Claim 1 Free Coffee"

---

## Field Changes Summary

### Removed
- `coffeesSinceLastVoucher`
- `coffeesUntilNextVoucher`
- `totalEarned`
- Voucher quantity selector in UI

### Added
- `coffeesUntilNextFree`
- `hasFreeCoffee`
- `counterReset` in redeem response
- FREE-xxx-yyy code format

### Renamed
- `coffeesRequiredForFree` (unchanged field, new meaning)

---

## Testing Checklist

### Basic Flow
- [ ] Register customer → paidCoffeesCount: 0
- [ ] Add 8 coffees → activeVouchers: 0
- [ ] Add 9th coffee → activeVouchers: 1, code starts "FREE-"
- [ ] Claim voucher → Get FREE code
- [ ] Use in order → coffeesUntilNextFree: 0
- [ ] Redeem → counterReset: true
- [ ] Fetch card → paidCoffeesCount: 0 (reset)

### No Stacking
- [ ] At 9 with 1 free → Add 10th coffee → Still only 1 free
- [ ] Claim after reset at 10 → 1 more free available

### Validation
- [ ] Can't claim if < 9 → Error message
- [ ] Can't claim if no free voucher → Error message
- [ ] Can't claim 2+ → Only returns 1

### Edge Cases
- [ ] Use code twice → 404 (deleted)
- [ ] Check progress bar % → (paidCoffeesCount/9)*100
- [ ] Multiple customers → Isolated counters

---

## Common Questions

**Q: Why 9 instead of 10?**  
A: Simpler for customers (9 is easier to count), leaves nice 0-9 range for progress display.

**Q: What if customer doesn't use free coffee?**  
A: It stays there at 9 until they order again. On next order, they can still use it.

**Q: Can they earn multiple free coffees?**  
A: No. Only 1 per cycle. Must use before next one appears.

**Q: What happens to old vouchers from 10-coffee system?**  
A: They still exist and work. New system generates alongside them. Old ones get used up naturally.

**Q: How do we display this on receipt?**  
A: Show: "7/9 paid coffees" and conditionally "✓ Free coffee earned" or "1 free coffee redeemed"

**Q: Can we customize the 9 threshold?**  
A: Yes! PATCH /api/loyalty/settings with { "coffeesRequiredForFree": X } but 9 is recommended.

---

## Monitoring

### Check System Health
```bash
# Verify settings
GET /api/loyalty/settings
→ Should show coffeesRequiredForFree: 9

# Check customer at each stage
GET /api/loyalty/cards/test-customer
→ Stage 1 (5 paid): activeVouchers: 0
→ Stage 2 (9 paid): activeVouchers: 1, hasFreeCoffee: true
→ Stage 3 (after use): paidCoffeesCount: 0, activeVouchers: 1 (new cycle)
```

### Alerts
- ⚠️ paidCoffeesCount > 9 → Should not happen (reset broken?)
- ⚠️ Multiple active vouchers per customer → Stacking occurred
- ⚠️ FREE voucher not deleted after order → Redemption broken?

---

## Deployment Checklist

- [ ] Deploy API changes (all 5 files)
- [ ] Test locally: full customer journey
- [ ] Deploy menu UI changes
- [ ] Run test-new-loyalty-cycle.js
- [ ] Monitor customer operations
- [ ] Document for support team
- [ ] Update customer-facing docs

---

## Reference Architecture

```
Customer Order Flow
│
├─ Order 1-8: paidCoffeesCount += 1
│  └─ No change to vouchers
│
├─ Order 9: FREE voucher auto-generated
│  └─ paidCoffeesCount: 9
│  └─ Menu shows: "Free coffee earned!"
│
├─ CLAIM: Customer presses button
│  └─ Gets code: FREE-xxx-yyy
│  └─ Saved to localStorage
│
├─ Order 10 (with free): Use FREE-xxx-yyy
│  └─ Order cost: reduced by coffee price
│  └─ Voucher deleted
│  └─ paidCoffeesCount: 0 (reset)
│
└─ Order 11+: New cycle starts
   └─ Back to paidCoffeesCount: 1
   └─ Repeat...
```

---

Feel free to print this or share with team! 🎯
