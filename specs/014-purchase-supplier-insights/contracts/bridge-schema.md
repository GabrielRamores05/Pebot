# Contracts — Inventory & Purchasing Intelligence (014)

Phase 1 output. This feature touches two cross-system seams: (1) the offline
**export/import JSON** shared by both apps and (2) the **tablet↔PC bridge**
payloads. Both already carry ingredient data; this contract only documents the
new fields and their rules so the two apps and the PC ledger stay consistent.

## Shared rules

- Money values travel as decimal numbers (pesos, unit cost) and are never
  rounded mid-pipeline; display rounding happens at render only.
- Purchase rows are append-only; voided rows keep their row but carry
  `"type":"VOID_PURCHASE"` and are ignored by all latest/trend consumers.
- A purchase row may omit supplier linkage (supplierless purchase is valid).

## Export/import JSON (menu/store snapshot)

Ingredient objects add:

```json
{
  "ingredientId": 12,
  "lastSupplierId": 3
}
```

IngredientTransaction objects add supplier linkage for purchases:

```json
{
  "transactionId": 7,
  "ingredientId": 12,
  "type": "PURCHASE",
  "quantity": 5000,
  "referenceType": "supplier",
  "referenceId": 3,
  "notes": "Arabica 5kg sack"
}
```

Import rules: parents (ingredients, suppliers) must be inserted/updated before
their transactions reference them; a purchase row referencing an unknown
supplier id is kept but its supplier link is cleared (`referenceType=null`),
never dropped as a record. Legacy rows without `referenceType`/`referenceId`
import unchanged (they remain supplierless purchases/adjustments).

## Tablet→PC bridge (PcBridge / snapshot payloads)

- The snapshot's `ingredients` array carries `lastSupplierId`.
- The `ingredientTransactions` array carries `referenceType`/`referenceId` as
  above.
- The PC applies a received purchase exactly like a locally recorded one:
  stock += quantity, `costPerUnit` = total ÷ converted quantity,
  `lastSupplierId` = referenceId when `referenceType='supplier'`, all in one
  transaction; VOID rows apply the reverse.

## HTTP/web surface (my-app admin)

Internal staff/admin routes only; no public endpoint changes. New/updated
actions are exposed through the existing service layer (repository modules own
Prisma access per project rule) for: record purchase, bulk adjust, void
purchase, supplier ingredient trends, ingredient purchase detail, analytics
inventory summary.
