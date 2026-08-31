# Spec 008: Tablet Feature Parity (Recipes & Design System)

## Context
The Android Tablet app requires full feature parity with the Windows version of CaféOS to ensure a consistent experience across terminals. The most critical missing feature is the **Recipe-Ingredient Linkage**, which enables automated inventory tracking.

## Technical Requirements

### 1. Data Model Parity
- **ProductIngredient Entity**: Junction table linking `Product` (1) to `Ingredient` (N).
  - `id`: Int (PK)
  - `productId`: Int (FK)
  - `ingredientId`: Int (FK)
  - `quantity`: Double (The amount in `Ingredient.baseUnit` used per 1 product unit)
  - `required`: Boolean (Default: true)

### 2. Business Logic: Automated Deduction
- Upon `Order` completion (POS checkout):
  - The system MUST iterate through all `OrderItems`.
  - For each `Product`, fetch its `ProductIngredient` list.
  - Decrement `Ingredient.currentStock` by `OrderItem.quantity * ProductIngredient.quantity`.
  - Log an `IngredientTransaction` of type `USAGE` for each deduction.

### 3. UI/UX: Design System
- **Colors**:
  - Background: `PosPaper` (#FAF7F2)
  - Text: `PosInk` (#1C1917)
  - Accent (Primary Action): `PosAccent` (#4A5D3A)
  - Border: `PosBorder` (#DDD6C8)
- **POS Layout**:
  - Left: Product grid (3 columns min).
  - Right: Cart sidebar with "Total" in Serif font.
- **Product Editor**:
  - Must include a "Recipe" section where ingredients can be selected from a list and their quantities specified.

## Acceptance Criteria
- [ ] Product "Americano" can be linked to "Coffee Beans" (20g).
- [ ] Selling 2 "Americanos" reduces "Coffee Beans" stock by 40g.
- [ ] "Total" on POS screen matches the Windows "Premium Native" style.
- [ ] Database successfully migrates to version 2 on device launch.
