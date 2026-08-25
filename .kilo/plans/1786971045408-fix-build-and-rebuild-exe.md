# Plan: Fix Next.js Build and Rebuild 1.0.4 EXE

## Status: COMPLETE
- **Code changes**: Complete (loyalty, suppliers, reviews, AI Consultant, expenses, black overlay fixes)
- **Type check**: `tsc --noEmit` passes with zero errors
- **Prisma**: Client regenerated, schema pushed to DB
- **Build**: Fixed by setting `HOME`, `USERPROFILE`, and `APPDATA` env vars to `C:\Users\Public\cafeos-home` (avoids Windows EPERM on `C:\Users\Gab\Application Data` junction points)
- **Build script**: Updated in `package.json` with working env vars for all scripts (dev, build, start, start:win)
- **NSIS installer**: Rebuilt and verified — `CaféOS Setup 1.0.4.exe` (232MB, 21/08/2026 1:55:43 am)
- **Verification**: All new routes confirmed in packaged app:
  - `/admin/expenses` (page + API)
  - `/api/expense-categories`
  - `/admin/consultant` (AI Consultant page)
  - All `/api/consultant/*` routes (analysis, charts, chat, conversations, conversations/[id], reports)
  - `/admin/reviews` (1-5 star rating)
  - `/admin/loyalty` and loyalty API routes
