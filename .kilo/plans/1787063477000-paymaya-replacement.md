# Plan: Replace Bank Transfer with PayMaya (QR-based)

## Status: Ready for Implementation

## Business Requirement

Only 3 payment methods: **Cash**, **GCash** (QR), **PayMaya** (QR). No bank transfer. PayMaya works the same as GCash — customer sees QR code on the order status page.

## Affected Files (9 files)

### 1. `prisma/schema.prisma`
- **Line 109**: Change comment `// CASH | GCASH | BANK_TRANSFER` → `// CASH | GCASH | PAYMAYA`
- **Lines 285-288**: Remove `bankName`, `bankAccountName`, `bankAccountNumber`, `bankQrImage`. Add `paymayaAccountName String?` and `paymayaQrImage String?`
- After edit: Run `npx prisma db push` to apply schema changes

### 2. `app/api/settings/business/route.ts`
- **Line 78-79**: In PUT destructure, replace `bankName, bankAccountName, bankAccountNumber, bankQrImage` with `paymayaAccountName, paymayaQrImage`
- **Line 106-107**: In `prisma.businessSettings.update` data, replace bank fields with `paymayaAccountName: paymayaAccountName ?? settings.paymayaAccountName` and `paymayaQrImage: paymayaQrImage ?? settings.paymayaQrImage`

### 3. `app/admin/settings/page.tsx`
- **Lines 58-61**: Replace state variables: `bankAccountName/setBankAccountName`, `bankAccountNumber/setBankAccountNumber`, `bankQrImage/setBankQrImage` → `paymayaAccountName/setPaymayaAccountName`, `paymayaQrImage/setPaymayaQrImage`
- **Lines 139-140**: Update fetchSettings: `setBankAccountName(d.bankAccountName...)`, `setBankAccountNumber(d.bankAccountNumber...)`, `setBankQrImage(d.bankQrImage...)` → paymaya equivalents
- **Lines 173-174**: Update save body: remove bank fields, add `paymayaAccountName: paymayaAccountName || null`, `paymayaQrImage: paymayaQrImage || null`
- **Lines 650-717**: Replace entire "Bank Transfer" section with "PayMaya" section — same structure as GCash (account name input + QR image upload), with `paymayaAccountName`/`paymayaQrImage` state

### 4. `app/admin/terminal/page.tsx`
- **Line 945**: Change `['CASH', 'GCASH', 'CARD']` → `['CASH', 'GCASH', 'PAYMAYA']`
- **Line 955**: Change `'Card'` → `'PayMaya'`
- **Line 1173**: Change `receipt.paymentMethod === 'CARD' ? 'CARD'` → `receipt.paymentMethod === 'PAYMAYA' ? 'PAYMAYA'`

### 5. `app/order/[orderNumber]/page.tsx` (customer order status page)
- **Lines 594-613**: Replace `BANK_TRANSFER` display block with `PAYMAYA` display block — same structure as GCash (account name + QR image), using `businessSettings.paymayaAccountName` and `businessSettings.paymayaQrImage`
- **Line 760**: Change `=== 'BANK_TRANSFER' ? '🏦 Bank Transfer'` → `=== 'PAYMAYA' ? '📱 PayMaya'`
- **Line 751-760**: Update payment method label/icon section

### 6. `app/cart/page.tsx` (customer cart/checkout)
- **Line 72**: Change TypeScript type `'CASH' | 'GCASH' | 'BANK_TRANSFER'` → `'CASH' | 'GCASH' | 'PAYMAYA'`
- **Line 521**: Change condition `paymentMethod === 'BANK_TRANSFER'` → `paymentMethod === 'PAYMAYA'`
- **Line 524**: Change `'Bank Transfer'` → `'PayMaya'`
- **Lines 529-534**: Replace bank fields display with `paymayaAccountName` display
- **Lines 535-540**: Replace `bankQrImage` with `paymayaQrImage`
- **Line 763**: Change `{ value: 'BANK_TRANSFER' as const, label: 'Bank', icon: '🏦' }` → `{ value: 'PAYMAYA' as const, label: 'PayMaya', icon: '📱' }`
- **Line 786**: Change `paymentMethod === 'BANK_TRANSFER'` → `paymentMethod === 'PAYMAYA'`
- **Line 789**: Change `'(Bank Transfer)'` → `'(PayMaya)'`

### 7. `app/admin/page.tsx`
- **Line 549**: Change payment method icon `=== 'GCASH' ? '📱' : '🏦'` → `=== 'GCASH' || === 'PAYMAYA' ? '📱' : '💵'`
- **Line 678**: Change color `=== 'GCASH' ? 'text-blue-600' : 'text-purple-600'` → `=== 'GCASH' || === 'PAYMAYA' ? 'text-blue-600' : 'text-slate-500'`
- **Lines 681-682**: Change `=== 'BANK_TRANSFER' ? 'Bank Transfer'` → `=== 'PAYMAYA' ? 'PayMaya'`
- **Line 929**: Change `=== 'CARD' ? 'CARD'` → `=== 'PAYMAYA' ? 'PAYMAYA'`

### 8. `app/admin/order-history/page.tsx`
- **Line 290**: Change `=== 'BANK_TRANSFER' ? '🏦 Bank'` → `=== 'PAYMAYA' ? '📱 PayMaya'`
- **Line 434**: Change `=== 'BANK_TRANSFER' ? 'Bank Transfer'` → `=== 'PAYMAYA' ? 'PayMaya'`

### 9. `app/api/payments/route.ts`
- **Line 9**: Change `method: 'CASH' | 'CARD' | 'EWALLET'` → `method: 'CASH' | 'PAYMAYA' | 'EWALLET'`
  (Note: This payment API may handle actual payment processing — verify before changing)

## Order of Implementation

1. Schema changes + `prisma db push`
2. API changes (settings business route)
3. Admin settings page
4. Terminal page
5. Cart page
6. Order status page
7. Admin page
8. Order history page
9. Payments API (if needed)
10. `npx tsc --noEmit` — verify all compiles

## Rollback

If database push fails, revert `prisma/schema.prisma` and skip db push. UI changes are safe to revert via git checkout.
