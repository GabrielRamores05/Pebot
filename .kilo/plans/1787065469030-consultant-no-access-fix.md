# Consultant AI "No Access" Bug Fix Plan

## Problem
Even when `aiFolderAccess` and `aiReadBirPricing` toggles are enabled in Settings, the AI consultant says "I don't have a direct connection to your POS system" and doesn't answer data questions.

## Root Cause
`app/api/consultant/chat/route.ts:110`

Server-side `fetch()` call to GET `/api/consultant/chat` does NOT forward the incoming request's auth cookies:

```typescript
const context = await fetch(`${req.nextUrl.origin}/api/consultant/chat`).then(...)
```

The GET handler calls `requirePermission(req, 'settings')` (line 8) which reads `cafeos-token` cookie via `getAuthUser(req)` in `lib/auth.ts:52`. Without forwarded cookies → auth fails → returns 401 → `context` is null → no business data injected into AI prompt.

## Fix (1 file, 1 line)

**File:** `app/api/consultant/chat/route.ts`
**Line:** 110

Change:
```typescript
const context = await fetch(`${req.nextUrl.origin}/api/consultant/chat`).then((r) => r.ok ? r.json() : null);
```

To:
```typescript
const context = await fetch(`${req.nextUrl.origin}/api/consultant/chat`, {
  headers: { cookie: req.headers.get('cookie') || '' },
}).then((r) => r.ok ? r.json() : null);
```

## Verification
- [ ] `tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] Enable `aiFolderAccess` in Settings, save, restart consultant page
- [ ] Ask "What are my recent sales?" → AI responds with business data
- [ ] Verify customer names are still sent in context (PII concern)
