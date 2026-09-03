# Field-Diff Summary — Windows Prisma ↔ Tablet Room (spec 013 evidence)

Produced 2026-09-04 by a read-only audit of `my-app/prisma/schema.prisma` (45 models)
vs `cafeos-tablet/.../data/Entities.kt` (33 tables) and `CafeDao.kt`. Full pairwise
tables live in the audit transcript; this file records the durable conclusions that
drive migrations and the PC-ledger sync mapping.

## Mapping corrections (facts that override assumptions)

- Windows has **no** models named `Option`, `Station`, `ProductStation`, `TableSection`,
  `SupplierIngredientPrice`, or standalone `Guest`. Windows options are per-product
  `ProductOption` rows; tablet uses a shared `Option` catalog + link table.
- `TableGuest` (Windows) pairs to tablet `Guest`. `AuditEvent` maps to Prisma table
  `AuditLog`. Tablet `Order` lives in table `Orders`.
- Order status vocabulary **matches already**: PENDING/PREPARING/COMPLETED/CANCELLED on
  both sides (`READY` appears only in a web zod enum, unused by any screen/route).
- Order types match: DINE_IN/TAKEOUT/DELIVERY (+ `deliveryAddress` on the Windows Order
  when DELIVERY).

## Status of alignment work (Phase 0, DB v17→v18)

Applied in `Entities.kt` + `MIGRATION_17_18`:
- Orders: +deliveryAddress, +notes, +loyaltyCustomerName, +loyaltyPromo, +queueNumber,
  +updatedAt, unique index on orderNumber; discountRate stays non-null (0.0 = none; the
  sync layer maps 0.0 ↔ null for Windows).
- Payment: +amount (charged = tendered − change), index on orderId.
- OrderMessage: +type "text"|"voice" (voice stores the audio URL in text); senderType
  vocabulary now lowercase customer/staff like Windows.
- BusinessSettings: +footerMessage, +loyaltyEnabled, +studentPwdDiscountRate, +aiApiKey,
  +aiModel, +aiSystemPrompt, +aiFolderAccess, +aiReadBirPricing.
- Staff: +Windows User HR profile (address, dateOfBirth, hireDate, position, department,
  profilePhoto, emergencyContactName/Phone, hourlyRate, monthlySalary, paymentType,
  updatedAt); role vocabulary to ADMIN/STAFF/KITCHEN (migration: no column change);
  permissions format to the web's 10-key JSON (screen work in Phase 1/6).
- Review: +customerName, +tasteSuggestion, +imageUrl.
- CafeTable: +slug, +updatedAt; status set includes NEEDS_CLEANING.
- Expense: +categoryId (name kept as display/legacy).
- IngredientTransaction: +referenceId, +referenceType; type set incl. OPENING.

## Deferred to their screen phases (own migrations when built)

- Option cluster remodel to Windows per-product semantics (+ProductOptionIngredient).
- LoyaltyVoucher/LoyaltySetting semantic alignment (Windows reward vouchers with
  customerName/cardId/rewardName/target*/redeemed*; typed loyalty config vs tablet kv).
- Date-based Schedule + Shift catalog; Training catalog; Inventory product-stock rows;
  RewardHistory; typed table-status/leave/payroll vocab alignment as needed by parity
  screens.
- `locationId` columns: intentionally NOT added (single café location; PC is the ledger
  and normalizes).

## Sync mapping notes (Phase 2 will implement)

- Dates: Windows ISO DateTime ↔ tablet epoch-ms Long.
- Identity: Windows uses string customer/loyalty identity (LoyaltyCard.customerName,
  Order.loyaltyCustomerName, Review.customerName); tablet has a Customer table + FKs —
  the PC bridge maps by name.
- Windows settings voice kv `voiceSettings` {enabled, voiceName, rate, pitch, volume}
  overlaps tablet BusinessSettings voice columns; daily-quota fields are tablet-only.
- Orders merge key on both sides: orderNumber (tablet unique index added in v18).
