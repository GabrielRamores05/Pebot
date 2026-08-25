# CaféOS Major Upgrade — Implementation Plan

## Overview

A major system upgrade spanning loyalty, checkout, UI fixes, AI consultant, suppliers, and reviews.
The codebase is a Next.js 14 + Electron + Prisma/SQLite POS system. Many features partially exist but need rework or extension.

## Architecture Summary

### Current Tech Stack
- **Frontend**: Next.js 14.2 (App Router), React 18.2, Tailwind CSS 4, Zustand (cart/store), Socket.IO
- **Backend**: Next.js API Routes, Prisma 5.22, SQLite
- **Desktop**: Electron 40.7.0
- **Auth**: JWT (jose), cookie-based, `requirePermission(req, feature)` for admin APIs
- **AI**: OpenRouter proxy, business context via `aiFolderAccess` toggle in BusinessSettings

### Available Libraries (from package.json)
- `jspdf` ^4.2.1 — PDF generation
- `jszip` ^3.10.1 — Excel/ZIP file generation
- `recharts` ^3.7.0 — charting
- `html2canvas` ^1.4.1 — screenshot/chart capture

### Existing Data Models (key ones)
- `User` (id, name, email, password, role, permissions JSON, active)
- `Category` (id, name, icon, sortOrder)
- `Product` (id, name, price, categoryId, capitalCost, marginType, marginValue, vatExempt, ...)
- `Order` (id, orderNumber, customerName, loyaltyCustomerName, status, totalAmount, paymentMethod, ...)
- `OrderItem` (orderId, productId, quantity, unitPrice, subtotal)
- `Ingredient` (id, name, currentStock, minStock, costPerUnit, supplierId)
- `Supplier` (id, name, contactPerson, phone, email, address)
- `ProductIngredient` (productId, ingredientId, quantity) — recipe linking
- `Inventory` (productId, quantity, lowStockThreshold)
- `LoyaltyCard` (id, customerName, membershipCode, memberSince, categoryId, paidCoffeesCount, claimedMilestones, ...)
- `LoyaltyVoucher` (code, customerName, cardId, discountType, status, ...)
- `LoyaltySetting` (categoryId, coffeesRequiredForFree, enabled, rewardType, ...)
- `Review` (productId, customerName, rating 1-10, comment, ...)
- `BusinessSettings` (businessName, aiApiKey, aiModel, aiSystemPrompt, aiFolderAccess, aiReadBirPricing, ...)
- `AuditLog` (userId, action, resource, resourceId, details, ip)

### Key File Locations
- Schema: `my-app/prisma/schema.prisma`
- Loyalty business logic: `my-app/lib/loyalty-award.ts`
- Loyalty utils: `my-app/lib/loyalty-utils.ts`
- Auth: `my-app/lib/auth.ts`
- Audit log: `my-app/lib/audit-log.ts`
- Socket: `my-app/lib/socket.ts`
- Prisma: `my-app/lib/prisma.ts`
- AI Consultant page: `my-app/app/admin/consultant/page.tsx`
- AI Consultant API: `my-app/app/api/consultant/chat/route.ts`
- Admin Loyalty page: `my-app/app/admin/loyalty/page.tsx`
- Admin Loyalty API: `my-app/app/api/loyalty/cards/route.ts`, `/cards/[customerName]/route.ts`
- Loyalty Register: `my-app/app/api/loyalty/register/route.ts`
- Loyalty Settings: `my-app/app/api/loyalty/settings/route.ts`
- Orders API: `my-app/app/api/orders/route.ts` (POST), `my-app/app/api/orders/[id]/route.ts` (PATCH)
- Cart page: `my-app/app/cart/page.tsx`
- Menu page: `my-app/app/menu/page.tsx`
- Admin Layout: `my-app/app/admin/layout.tsx`
- Settings page: `my-app/app/admin/settings/page.tsx`
- Admin Products: `my-app/app/admin/products/page.tsx`
- Admin Inventory: `my-app/app/admin/inventory/page.tsx`
- Suppliers API: `my-app/app/api/suppliers/route.ts`
- Inventory API: `my-app/app/api/inventory/route.ts`

---

## Task 1: Loyalty Management System Rewrite

### Problem
- Uses "coffee stamp" model (paidCoffeesCount + threshold for free vouchers), NOT "1 coffee = 1 point"
- No `loyaltyPoints` field on LoyaltyCard
- No `LoyaltyTransaction` model for award traceability
- Points awarded on `paymentConfirmed`, not order completion
- No duplicate prevention
- No point reversal on cancellation
- Admin page shows coffeesCompleted/rewardsAvailable, not points

### Schema Changes
1. Add `loyaltyPoints Int @default(0)` to `LoyaltyCard` model
2. Add `LoyaltyTransaction` model:
```prisma
model LoyaltyTransaction {
  id          Int      @id @default(autoincrement())
  cardId      Int
  card        LoyaltyCard @relation(fields: [cardId], references: [id])
  orderId     Int?
  order       Order?   @relation(fields: [orderId], references: [id])
  action      String   // "EARN" | "REVOKE" | "MANUAL_ADD" | "MANUAL_REMOVE"
  points      Int
  reason      String?
  createdAt   DateTime @default(now())
}
```
Add `loyaltyTransactions LoyaltyTransaction[]` to `LoyaltyCard` and `loyaltyTransactions LoyaltyTransaction[]` to `Order`.

### Business Logic Changes
1. **Coffee identification**: A product counts as "coffee" if its Category name contains "coffee" (case-insensitive). This is the existing pattern - the `LoyaltySetting` uses `coffeesRequiredForFree` and groups by category.

2. **Award logic** (`lib/loyalty-award.ts`):
   - Replace `awardLoyaltyForPaidOrder` to award **1 point per coffee item** (not the threshold model)
   - Count only items where the product's category name contains "coffee"
   - Award points when order reaches COMPLETED status OR payment is confirmed
   - Check if a `LoyaltyTransaction` already exists for this order+card before awarding (duplicate prevention)
   - Only award to the customer's Global card (categoryId = null) or the matching category card

3. **Order completion trigger** (`app/api/orders/[id]/route.ts` PATCH):
   - When `status === 'COMPLETED'`, call the new point-awarding function
   - Ensure points are only awarded once per order (check LoyaltyTransaction table)
   - When `status === 'CANCELLED'`, revoke previously awarded points (create REVOKE transactions, decrement `loyaltyPoints`)

4. **Order placement** (`app/api/orders/route.ts` POST):
   - Update to handle new points model
   - Award points if `paymentConfirmed === true` (existing behavior, but now using points instead of coffees)

5. **Cart page** (`app/cart/page.tsx`):
   - Update to send `loyaltyCustomerName` field to orders API
   - Display current loyalty points in confirmation dialog

### Admin Loyalty Page (`app/admin/loyalty/page.tsx`)
- Change "Coffees Earned" stat to "Loyalty Points"
- Update card interface to show `loyaltyPoints`
- Add column for points in the customer list
- In the detail modal, show:
  - Loyalty points (instead of/in addition to coffees completed)
  - Transaction history (EARN/REVOKE/MANUAL)
  - Add/Remove points modal (already exists, update to use points model)
- Ensure delete removes only the loyalty card + vouchers, NOT orders or customer data
  - Current DELETE in `/cards/[customerName]/route.ts` already only deletes `LoyaltyCard` and `LoyaltyVoucher` — verify and add `LoyaltyTransaction` cleanup

### API Endpoints
- `GET /api/loyalty/cards` — Add `loyaltyPoints` to response
- `GET /api/loyalty/cards/:customerName` — Add `loyaltyPoints` to response
- `POST /api/loyalty/cards/:customerName` (add-coffees) — Change to "add-points" semantics
- Add `GET /api/loyalty/transactions?customerName=X` — Fetch transaction history
- `GET /api/loyalty/register/check?name=X` — Check name availability (already exists)

---

## Task 2: Customer Checkout — Loyalty Experience Cleanup

### Current State
- Cart page has confirmation dialog with order summary
- Shows "✓ Loyalty member registered" if `isNameFromLoyalty`
- Payment methods: Cash, GCash, PayMaya (already correct)
- Warning about cancellation is present
- After placing order, navigates to `/order/[orderNumber]`

### Improvements
1. In confirmation dialog, show loyalty points balance alongside "Registered" status
2. Ensure `loyaltyCustomerName` is sent to API
3. Verify the final order confirmation page (`/order/[orderNumber]`) accurately reflects all info
4. Make the checkout responsive (already uses responsive grid)

### Files
- `app/cart/page.tsx` — Update loyalty display in confirm dialog
- `app/order/[orderNumber]/page.tsx` — Verify order confirmation accuracy

---

## Task 3: Black Overlay / UI Rendering Fix

### Investigation Needed
The black overlay issue could stem from:
1. **Menu page**: `MyOrdersPanel` (line 98-100) and `MyLoyaltyCardPanel` (line 275-276) both use `bg-black/30` as a backdrop that fills the screen. If the panel state isn't properly reset, the backdrop remains.
2. **Menu page**: `showEntryModal` backdrop at line 1404 (`bg-black/30`)
3. **`animate-backdrop` CSS**: Animation from opacity 0→1. If a modal is added to DOM but the animation context fails, it might appear as a sudden black block.
4. **`body.style.overflow`**: ProductCard sets `document.body.style.overflow = 'hidden'` on modal open (line 555) but resets on close (line 562). If a modal doesn't close properly, scrolling breaks but this isn't the overlay.
5. **Admin layout**: Mobile sidebar overlay `bg-black/50 z-40 md:hidden` (line 454) — should be hidden on desktop.

### Root Cause Analysis Approach
1. Search all `fixed inset-0` elements for missing `onClick` close handlers
2. Ensure every modal has a reliable close path (Escape key, backdrop click, X button)
3. Ensure `body.style.overflow` is always reset (cleanup in useEffect or try/finally)
4. Check the `animate-backdrop` animation keyframes — the `backdrop-dim` animation (line 331-334) goes from opacity 0 to 1, which is correct for fade-in. But there's no fade-out animation, so the backdrop appears instantly.

### Specific Fix
The most likely cause is a **stuck modal state** in the menu page. The `showLoyalty` or `showEntryModal` state variables may persist or not reset properly. Fix:
1. Add `document.body.style.overflow = ''` cleanup in all modal components
2. Ensure modals properly unmount by checking state conditions
3. Add `onClick` backdrop click handlers that reliably close the modal
4. Add Escape key handling for all modals

### Files to Check
- `app/menu/page.tsx` — MyOrdersPanel, MyLoyaltyCardPanel, ProductCard modal, entry modal
- `app/admin/layout.tsx` — Mobile sidebar overlay (line 451-457)
- `app/admin/page.tsx` — Invoice modal (line 874), voice panel overlay
- `app/admin/terminal/page.tsx` — Loyalty modal overlay (line 769)
- `app/admin/settings/page.tsx` — Delete user modal, create user modal

---

## Task 4: AI Consultant — Conversation Persistence

### Schema Changes
Add to `schema.prisma`:
```prisma
model AIConversation {
  id        Int          @id @default(autoincrement())
  userId    Int
  user      User         @relation(fields: [userId], references: [id])
  title     String
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
  messages  AIMessage[]
}

model AIMessage {
  id             Int              @id @default(autoincrement())
  conversationId Int
  conversation   AIConversation   @relation(fields: [conversationId], references: [id])
  role           String           // "user" | "assistant" | "system"
  content        String
  createdAt      DateTime         @default(now())
  metadata       Json?            // Optional: model used, tokens, etc.
}
```
Add `aiConversations AIConversation[]` to `User` model.

### API Endpoints
- `GET /api/consultant/conversations` — List user's conversations (id, title, createdAt, updatedAt)
- `POST /api/consultant/conversations` — Create new conversation (with optional title)
- `GET /api/consultant/conversations/:id` — Get conversation with all messages
- `PATCH /api/consultant/conversations/:id` — Rename conversation (update title)
- `DELETE /api/consultant/conversations/:id` — Delete conversation
- `POST /api/consultant/conversations/:id/messages` — Add message to conversation

### Frontend Changes (`app/admin/consultant/page.tsx`)
1. Add sidebar with conversation list (conversation ID, title, created/updated dates)
2. "New Conversation" button
3. Click to switch conversations (load messages from API)
4. Conversation state persists across navigation (store in localStorage as fallback, sync with API)
5. Page refresh restores conversation (load from API with URL param `?id=X`)
6. Auto-generate conversation title from first user message (truncate to 40 chars, use first phrase)
7. Rename/delete conversation from sidebar context menu

### Implementation Details
- Current conversation ID stored in React state + URL param
- On navigation away from consultant page, conversation is saved (not cleared)
- On return, if URL has `?id=X`, load that conversation; otherwise show list
- All messages saved to DB on each send
- System message (with business context) is NOT stored in DB — it's regenerated on each API call

---

## Task 5: AI Consultant — Full CaféOS Data Access

### Current State
GET `/api/consultant/chat` returns:
- `hasAccess` (boolean)
- `businessName`
- `menu`: products (50 limit, name/price/category/description only)
- `inventory`: ingredients (50 limit, only if `aiReadBirPricing`)
- `recentOrders`: 20 orders (only if `aiFolderAccess`)

### Extended Business Context
Add these data sets to the GET response:

1. **Products**: Full catalog (no 50 limit) including:
   - name, price, description, available, categoryId, categoryName
   - capitalCost, marginType, marginValue, vatExempt (for costing)

2. **Ingredients**: Full list including:
   - name, currentStock, minStock, baseUnit, costPerUnit, supplier name
   - ProductIngredient relationships (recipe composition)

3. **Product Costing** (computed):
   - For each product: total ingredient cost = sum(pi.quantity × ingredient.costPerUnit)
   - COGS per product, gross profit, gross margin %, markup

4. **Orders**: Full order history (no 20 limit) including:
   - orderNumber, customerName, status, totalAmount, paymentMethod, createdAt
   - items: productId, productName, quantity, unitPrice, subtotal

5. **Inventory**: Current stock levels for all products and ingredients

6. **Suppliers**: All supplier details

7. **Customers**: 
   - Loyalty members: name, loyaltyPoints, membershipCode, memberSince
   - Non-members: aggregated from orders (name, totalOrders, lifetimeValue)
   - Exclude sensitive data (passwords, emails unless authorized)

8. **Loyalty**: All cards with points and transaction history

9. **Expenses** (new — see Task below): All expenses with categories

### New API Endpoint
Create `GET /api/consultant/context` that returns ALL business data in a structured format, respecting `aiFolderAccess` and `aiReadBirPricing` toggles. The POST handler should call this endpoint to get context instead of inlining the data fetch.

### Implementation
- Replace the inline data fetch in POST handler with a call to `GET /api/consultant/context`
- Add deterministic calculation functions in `lib/ai-business-data.ts`:
  - `calculateProductCost(productId)` — ingredient cost + COGS
  - `calculateProfitability()` — gross profit/margin by product
  - `getSalesSummary()` — revenue by date range
  - `getLowStockAlerts()` — items below threshold

---

## Task 5b: Expense Model (for AI data access)

### Schema Addition
```prisma
model Expense {
  id          Int       @id @default(autoincrement())
  date        DateTime  @default(now())
  categoryId  Int?
  category    ExpenseCategory? @relation(fields: [categoryId], references: [id])
  description String
  amount      Float
  paymentMethod String?  // CASH | GCASH | PAYMAYA | CARD
  receiptImage String?   // For receipt storage
  recordedById Int?
  recordedBy  User?    @relation(fields: [recordedById], references: [id])
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model ExpenseCategory {
  id          Int        @id @default(autoincrement())
  name        String     @unique
  description String?
  expenses    Expense[]
  createdAt   DateTime   @default(now())
}
```
Add `expenses Expense[]` to `User` and `ExpenseCategory`.

### API Endpoint
`GET /api/expenses` — List expenses (with optional date range, category filter)
`POST /api/expenses` — Create expense
`GET /api/expense-categories` — List categories
`POST /api/expense-categories` — Create category

### Admin UI
Add "Expenses" tab under Settings or a new "Financial" section, with list/add/edit/delete.

---

## Task 6: AI Consultant — Accurate Business Analysis

### Approach
Create dedicated analysis functions in `lib/ai-business-data.ts` that compute deterministic results:

1. **Product Profitability**: 
   - For each product: ingredient cost = Σ(ProductIngredient.quantity × Ingredient.costPerUnit)
   - Gross profit = price - ingredient cost
   - Gross margin % = (gross profit / price) × 100
   - Markup % = (gross profit / ingredient cost) × 100

2. **Sales Analysis**:
   - Revenue by date (today, this week, this month, last month)
   - Compare periods (month-over-month growth)

3. **Customer Analysis**:
   - Top customers by total spend
   - Customer frequency
   - Loyalty activity

### Integration with AI
The business context API (`GET /api/consultant/context`) should include pre-computed analytics:
- `profitabilityByProduct`: [{ name, ingredientCost, price, grossProfit, marginPercent, markupPercent, totalSold }]
- `salesSummary`: { today, thisWeek, thisMonth, lastMonth, growthRate }
- `topProducts`: by revenue, by quantity
- `lowStockItems`: products/ingredients below threshold
- `customerInsights`: top customers, frequency, lifetime value

---

## Task 7: AI Consultant — Reports and File Generation

### API Endpoints
- `POST /api/consultant/report` — Generate a report (PDF/Excel/CSV)
  - Body: `{ type: 'sales' | 'inventory' | 'profitability' | 'custom', format: 'pdf' | 'excel' | 'csv', period: { from, to }, title }`
  - Returns: `{ downloadUrl: string }` or file stream

### Report Types
1. **Sales Report**: Order history, revenue, items sold, payment breakdown
2. **Inventory Report**: Current stock, low-stock alerts, inventory valuation
3. **Product Profitability Report**: Cost breakdown, gross profit, margin per product
4. **Financial Report**: Revenue, COGS, gross profit, expenses, net profit

### Implementation
- Use `jspdf` for PDF generation (with tables plugin if available, or manual table rendering)
- Use `jszip` for Excel (generate xlsx XML manually or use a simple approach)
- CSV generation is straightforward (string join)

### Report Content
Each report includes:
- Title with date/period
- Generated date
- Tables with data
- Summary section (totals, key metrics)
- Recommendations (for profitability reports)
- CaféOS branding (business name from settings)

### Frontend Integration
- AI chat response includes "Generate a report" action buttons
- User clicks button → calls API → download starts
- Add `GET /api/consultant/reports/[id]` or stream response

---

## Task 8: AI Consultant — Data Visualizations

### Approach
Use `recharts` (already installed) to generate chart images, convert to PNG using `html2canvas`, and return as image data URL.

### Chart Types to Support
1. Sales trend (line chart)
2. Revenue by product (bar chart)
3. Revenue by category (pie chart)
4. Profit by product (bar chart)
5. Top-selling products (horizontal bar)
6. Inventory usage (bar chart)
7. Expense breakdown (pie chart)

### API Endpoints
- `GET /api/consultant/chart?type=sales_trend&period=month` — Returns PNG image data
  - Renders chart on server using react-recharts + html2canvas (or generate SVG and convert)
  - Alternative: Return structured data + let frontend render charts in chat

### Frontend Integration
- AI response can include chart images alongside text
- Charts are based on real data from the business context API
- Responsive chart rendering in the chat interface

### Implementation Note
Server-side chart generation in Next.js API routes is challenging (react-recharts needs DOM). Alternative approaches:
1. Return raw data from API, render charts client-side in the consultant page
2. Use a library like `quickchart.io` (but this sends data externally — not ideal)
3. Generate SVG on server and convert to PNG

Recommended: **Option 1** — Return structured data, render charts client-side. The AI's response includes a directive like `{"chart": {"type": "bar", "data": [...]}}` that the frontend interprets.

---

## Task 9: AI Data Permissions & Security

### Current State
- AI requires `settings` permission (admin only via `requirePermission`)
- `aiFolderAccess` toggle controls business data access
- `aiReadBirPricing` toggle controls sensitive pricing data
- POST handler re-fetches context by making an internal GET call with cookie forwarding

### Improvements
1. All business context functions should go through dedicated API endpoints (not direct DB queries from chat handler)
2. The POST handler already calls GET internally — ensure this is maintained
3. Add specific permission checks for expense data (should require higher clearance)
4. Never expose: user passwords, emails (unless authorized), API keys
5. AI can only READ — never modify data (no mutation endpoints exposed to AI)

### Implementation
- Create `lib/ai-permissions.ts` with helper functions that filter data based on settings
- All AI data access routes through `/api/consultant/context` with proper permission checks

---

## Task 10: Supplier Management

### Current State
- `Supplier` model exists with: id, name, contactPerson, phone, email, address, ingredients relation
- API at `/api/suppliers` with full CRUD
- Admin products page has Suppliers tab (in Ingredients section) for add/edit
- Inventory page shows supplier when editing ingredients

### Required Additions
1. **Dedicated Supplier Management Page** under Inventory (`/admin/inventory/suppliers`)
   - List all suppliers with search
   - Show: name, contact person, phone, email, address, products/ingredients supplied, notes, status
   - Add/Edit/Delete suppliers
2. **Schema Changes**: Add `notes` and `status` fields to `Supplier` model
   ```prisma
   notes   String?
   status  String @default("ACTIVE")
   ```
3. **Supplier Association**: Link suppliers to ingredients (already exists via `supplierId`)

### Files to Create/Modify
- `app/admin/inventory/suppliers/page.tsx` — New supplier management page
- `prisma/schema.prisma` — Add `notes` and `status` to `Supplier`
- `app/api/suppliers/route.ts` — Add notes/status fields, add search parameter
- `app/admin/layout.tsx` or `app/admin/inventory/page.tsx` — Add link to suppliers page

---

## Task 11: Product Reviews

### Current State
- `Review` model: `rating: Int` (1-10 scale), `customerName`, `comment`, `tasteSuggestion`, `imageUrl`
- API at `/api/reviews` with GET (by product or all) and POST
- Menu product card: 10-star rating display, "Write a Review" form
- Admin products page: Shows 5-star display (implicitly dividing 10-star ratings by 2)
- `/menu/reviews` page exists and is linked in customer navbar

### Changes Required

#### 1. Rating Scale Change (1-10 → 1-5)
- **Schema**: Change `rating: Int` to `rating: Int @default(1)` with comment `// 1-5 stars`
- **API validation**: Change from `rating < 1 || rating > 10` to `rating < 1 || rating > 5`
- **Menu product card**: Change star selector from 10 stars to 5 stars
- **Menu review display**: Change `'☆'.repeat(10 - review.rating)` to `'☆'.repeat(5 - review.rating)`
- **Suggestions page**: Change `(review.rating/10)` to `(review.rating/5)`
- **Admin products page**: Remove implicit division by 2, use actual 1-5 scale

#### 2. Remove `/menu/reviews` from Customer Navbar
- Remove the `<Link href="/menu/reviews">` from the menu page navbar (line 1671)
- Keep the `/menu/reviews` page existing (or remove it entirely)

#### 3. Admin Review Management
- Add a "Reviews" tab or section in the Admin Products page
- Show: product name, customer name, rating, comment, date
- Allow admin to delete inappropriate reviews
- Add `DELETE /api/reviews?reviewId=X` or `DELETE /api/reviews/:id`

#### 4. Product Detail Page (Customer)
- Already has "Add Review" button and review form on product card
- Ensure product name is shown in review section
- Already correctly associates reviews with products via `productId`

### Files to Modify
- `prisma/schema.prisma` — Change Review rating range
- `app/api/reviews/route.ts` — Change validation to 1-5
- `app/menu/page.tsx` — Change star display to 1-5, remove navbar link
- `app/menu/reviews/page.tsx` — Change star display to 1-5
- `app/menu/suggestions/page.tsx` — Change star display to 1-5
- `app/admin/products/page.tsx` — Add Review management tab
- `app/api/reviews/route.ts` — Add DELETE endpoint

---

## Task 12: UI/UX Requirements

### General Improvements
1. **Consistent styling**: Ensure all modals have consistent close behavior and backdrop
2. **Loading states**: Add proper loading indicators for all async operations
3. **Error states**: Ensure errors are displayed clearly
4. **Mobile responsiveness**: Verify all pages work on mobile/tablet
5. **Remove debug code**: Remove `console.log('[LAYOUT] ...')` from admin layout

### Specific Fixes
1. Remove `console.log` from `app/admin/layout.tsx` line 53
2. Ensure all modal backdrops have proper click-to-close behavior
3. Ensure `body.style.overflow` is reset when modals close
4. Consistent modal header styles across all pages

---

## Task 13: Database & Backend Integrity

### Schema Migrations
Run `npx prisma generate` and `npx prisma db push` after all schema changes.

### Data Integrity
1. **Loyalty points**: `loyaltyPoints` field on `LoyaltyCard`, tracked via `LoyaltyTransaction`
2. **Order loyalty**: `LoyaltyTransaction.orderId` links to `Order.id`
3. **Reviews**: `Review.productId` links to `Product.id` (already correct)
4. **Suppliers**: `Ingredient.supplierId` links to `Supplier.id` (already correct)
5. **AI Conversations**: `AIMessage.conversationId` links to `AIConversation.id`
6. **Expenses**: `Expense.categoryId` links to `ExpenseCategory.id`, `Expense.recordedById` links to `User.id`

### Backward Compatibility
- Existing `paidCoffeesCount` on LoyaltyCard: Keep field for backward compatibility, but new system uses `loyaltyPoints`
- Existing 1-10 ratings: Convert to 1-5 (divide by 2) in a migration script
- Existing loyalty program settings: Keep the `coffeesRequiredForFree` threshold for the voucher system (parallel to points)

### Idempotency
- Loyalty point awards: Check if `LoyaltyTransaction` already exists for orderId before awarding
- AI conversation creation: Use unique conversation IDs
- Report generation: Allow regeneration

---

## Task 14: Testing Requirements

### Loyalty Tests
1. **Register customer** → appears in Loyalty Management page
2. **Place order with 1 coffee** → +1 point awarded
3. **Place order with 3 coffees** → +3 points awarded
4. **Re-confirm same order payment** → no duplicate points
5. **Cancel order** → points revoked
6. **Add points manually** → points increase, transaction logged
7. **Delete loyalty member** → card deleted, orders intact, transactions cleaned up
8. **Refresh page** → all changes persist

### Checkout Tests
1. **Cash payment** → order placed, points awarded
2. **GCash payment** → QR displayed, order placed
3. **PayMaya payment** → QR displayed, order placed
4. **Loyalty member checkout** → current points shown in confirmation
5. **Non-loyalty customer** → name registered, loyalty card created
6. **Order confirmation** → correct products, quantities, prices, total, customer name, payment method

### Review Tests
1. **Open product** → see existing reviews and average rating
2. **Submit 1-star review** → appears under correct product
3. **Submit 5-star review** → average rating updates correctly
4. **Rating scale** → 1-5 stars only (no 1-10)

### Supplier Tests
1. **Add supplier** → appears in list
2. **Edit supplier** → changes persist
3. **Delete supplier** → removed from list
4. **Associate with ingredient** → reflected in inventory
5. **Search suppliers** → filters correctly

### AI Consultant Tests
1. **Start conversation** → saved to database
2. **Navigate away** → conversation preserved
3. **Refresh page** → conversation restored
4. **New conversation** → fresh chat, old one in history
5. **Switch conversations** → correct messages loaded
6. **Ask about sales** → gets real sales data
7. **Ask about profitability** → gets real cost data
8. **Generate report** → downloads PDF/Excel/CSV
9. **Generate chart** → renders with real data

### Black Overlay Tests
1. **Menu page** → no stuck overlays when opening/closing modals
2. **Admin pages** → modals open/close properly
3. **Navigation** → no leftover backdrops

---

## Implementation Order

1. **Schema changes** (prisma/schema.prisma) — Add all new models and fields
2. **Prisma generate + db push** — Update database
3. **Loyalty system** — Update business logic, API, admin page, cart
4. **Black overlay fix** — Audit all modals, fix stuck states
5. **Supplier management** — Add notes/status to schema, create dedicated page
6. **Product reviews** — Change to 1-5 scale, add admin management, remove nav link
7. **AI Consultant v1** — Conversation persistence (schema, API, frontend)
8. **AI Consultant v2** — Full business data context API
9. **AI Consultant v3** — Deterministic analysis functions
10. **AI Consultant v4** — Report/file generation
11. **AI Consultant v5** — Chart/visualization support
12. **Expense model** — Schema, API, admin UI
13. **UI/UX cleanup** — Remove debug code, fix consistency
14. **Testing** — Verify all workflows
15. **Build** — `tsc --noEmit`, `next build`, rebuild NSIS installer

## Key Decisions

1. **Coffee identification**: Use Category name containing "coffee" (case-insensitive) — this is the existing pattern and requires no schema changes to Product
2. **Points model**: Add `loyaltyPoints` to existing `LoyaltyCard`, keep `paidCoffeesCount` for backward compatibility with existing voucher system
3. **Conversation storage**: Store in DB with `AIConversation` and `AIMessage` models; use localStorage as fallback for unsaved messages
4. **Report generation**: Use `jspdf` (already installed), `jszip` (already installed), CSV (manual string generation)
5. **Charts**: Return structured data from API, render client-side with `recharts` (already installed)
6. **Expenses**: New `Expense` and `ExpenseCategory` models, simple CRUD API
7. **Reviews**: 1-5 star scale, migrate existing 1-10 ratings by dividing by 2
