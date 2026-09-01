# Spec 009: Tablet Product Management Parity

## Context
The Windows Pebot POS (`my-app/`) already has full product management with BIR pricing, recipe ingredients, option groups, and media support. The Android tablet (`cafeos-tablet/`) currently lacks these features. This spec defines the requirements for feature parity.

## Current Windows System Analysis

### Product Entity Fields
- `name` — display name
- `description` — optional long text
- `price` — final selling price (auto-calculated from BIR pricing)
- `categoryId` — FK to Category
- `imageUrl` — product photo
- `prepTimeMinutes` — kitchen prep time
- `stationType` — coffee, kitchen, bar, pastry, general
- `capitalCost` — sum of ingredient costs × quantities
- `marginType` — `PERCENTAGE` or `FIXED`
- `marginValue` — percentage or fixed peso amount
- `vatExempt` — boolean

### BIR Pricing Engine (`lib/bir-pricing.ts`)
```typescript
marginAmount(capitalCost, marginType, marginValue)
basePrice(capitalCost, marginType, marginValue)      // capital + margin
vatAmount(base, vatExempt)                           // 12% or 0
sellingPrice(capitalCost, marginType, marginValue, vatExempt) // final price
```

### Recipe System
- `ProductIngredient` junction: `productId`, `ingredientId`, `quantity`, `required`
- Windows admin page (`app/admin/products/page.tsx`) has a "Recipe" section in the product modal
- Automated capital calculation: Σ (ingredient.costPerUnit × quantity)

### Option Groups
- `OptionGroup`: name, selectionType (`single`/`multi`), sortOrder
- `ProductOptionGroup`: productId, groupId
- `Option`: groupId, name, priceDelta, sortOrder
- Windows product modal attaches option groups and renders them in customer menu

### Media
- Product images uploaded via `/api/upload` endpoint
- Stored as `imageUrl` string on Product

## Tablet Requirements

### 1. Product Management
- Full CRUD for products with all Windows fields:
  - name, description, category, price, image, prepTime, stationType
  - capitalCost, marginType, marginValue, vatExempt
- Price auto-calculation when BIR fields change
- Image upload from gallery/camera

### 2. Automated Capital Calculation
- Recipe editor inside product form
- List of available ingredients with quantity input
- Real-time capital calculation: Σ (ingredient.costPerUnit × inputQuantity)
- Display capital cost prominently in product form

### 3. Profit Margin Calculation
- Margin type selector: Percentage / Fixed
- Margin value input
- Real-time price preview:
  - Base = capitalCost + marginAmount
  - VAT = base × 12% (or 0 if exempt)
  - Final = base + VAT
- Auto-suggested price applied when saving

### 4. Media Support
- Image picker in product form
- Store image as local file path or base64 in Room DB
- Display thumbnail in product list

### 5. Option Groups
- Create/edit option groups (name, selectionType)
- Attach groups to products
- Add options with name and price delta
- Store in `OptionGroup`, `ProductOptionGroup`, `Option` tables

## Data Model Changes

Already completed:
- `ProductIngredient` entity added
- `OptionGroup`, `ProductOptionGroup`, `Option` entities added
- DAO queries added for all new entities

## UI Layout

### Product Form Screen
```
┌─────────────────────────────────────┐
│ Product Editor                   [X] │
├─────────────────────────────────────┤
│ Name: [______________]              │
│ Category: [Dropdown]                │
│ Description: [______________]       │
│ Price: ₱______ (auto-calculated)    │
│ Capital: ₱______ (from recipes)     │
│ Margin: [Percentage ▼] Value: [__] │
│ VAT Exempt: [ ]                     │
│ Image: [Upload] [Preview]           │
│ Station: [Dropdown]                 │
│ Prep Time: [__] mins                │
├─────────────────────────────────────┤
│ Recipe                             │
│ ┌─────────────────────────────────┐ │
│ │ Ingredient    Qty    Cost       │ │
│ │ Coffee Beans  20g    ₱12.00    │ │
│ │ Fresh Milk    150ml  ₱12.00    │ │
│ │ [+ Add Ingredient]              │ │
│ └─────────────────────────────────┘ │
│ Capital Total: ₱24.00               │
├─────────────────────────────────────┤
│ Option Groups                    [+] │
│ ┌─────────────────────────────────┐ │
│ │ Size (single)                   │ │
│ │   Small  +₱0                    │ │
│ │   Medium +₱15                   │ │
│ │   Large  +₱30                   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Save]                              │
└─────────────────────────────────────┘
```

## Implementation Tasks

1. Add BIR pricing helper functions to ViewModel
2. Update Product entity/form to include BIR fields
3. Add recipe editor sub-screen
4. Add option group manager sub-screen
5. Add image upload handler
6. Update export/import to include new entities
7. Update POS bottom sheet to use product option groups instead of hardcoded options

## Acceptance Criteria
- [x] Product can be created with capital cost, margin, and VAT settings
- [x] Price auto-calculates when BIR fields change (`calculateBirPrice()` in CafeViewModel)
- [x] Recipe editor calculates capital total from ingredients (`saveProductRecipe()`, `calculateCapitalFromRecipe()`)
- [x] Option groups can be created and attached to products (`OptionGroupScreen`, `ProductOptionsBottomSheet` uses data-driven groups)
- [x] Product images can be selected and displayed (`saveProductImage()`, `ProductCard` renders bitmap from file path)
- [x] Export/import preserves all product data (includes optionGroups, options, expenses, businessSettings)
