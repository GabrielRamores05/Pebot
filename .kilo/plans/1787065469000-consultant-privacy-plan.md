# AI Consultant Privacy & Security Enhancement Plan

## Problem
The AI Consultant (Feature 13) sends business context to OpenRouter AI, including:
- Recent order data with **customer names** (PII exposure)
- Inventory with **cost prices** and **supplier info** (BIR financial data)
- Menu with full pricing structure

When `aiFolderAccess` is enabled in Settings, this data is transmitted to a third-party service (OpenRouter).

## Current State
File: `app/api/consultant/chat/route.ts`

- GET `/api/consultant/chat` — returns business context snapshot
- POST `/api/consultant/chat` — proxies messages to OpenRouter API
- Context data includes: menu items, inventory (if `aiReadBirPricing`), recent orders (with customer names)
- Two toggles exist: `aiFolderAccess` (master), `aiReadBirPricing` (inventory costs)
- API key is server-side only, never exposed to client
- Auth check: `requirePermission(req, 'settings')` — admin-only

## Proposed Changes

### 1. Redact customer PII from order context
**File**: `app/api/consultant/chat/route.ts` (GET handler, lines 58-66)

Current:
```typescript
recentOrders: recentOrders.map((o) => ({
  orderNumber: o.orderNumber,
  customerName: o.customerName,  // PII exposed
  ...
}))
```

Change to anonymize customer names:
```typescript
recentOrders: recentOrders.map((o) => ({
  orderNumber: o.orderNumber,
  customerName: o.customerName ? `Customer #${o.id}` : null,  // Anonymized
  ...
}))
```

### 2. Add explicit consent toggle for order data
**File**: `app/api/consultant/chat/route.ts` + `app/admin/settings/page.tsx`

Add a third toggle `aiShareOrders` that must be explicitly enabled to share order data with the AI. If disabled, recent orders are not included in the context.

### 3. Add data minimization option
**File**: `app/api/consultant/chat/route.ts`

Provide a setting to limit the number of recent orders shared (e.g., last 5 instead of last 20).

## Out of Scope
- No changes to the core chat proxy (messages → OpenRouter)
- No changes to auth model (admin-only stays)
- No changes to API key handling (server-side only)
- No encryption-at-rest changes (SQLite limitation)

## Validation
- [ ] Customer names are NOT sent to OpenRouter when order data is in context
- [ ] Setting `aiShareOrders=false` excludes all order data from context
- [ ] System still functions correctly with reduced context
- [ ] tsc --noEmit passes
- [ ] Build succeeds
