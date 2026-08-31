# System Design Document: PEBOT Android Tablet Terminal

## Architecture: Reactive Local-First
The tablet terminal operates as a high-performance, offline-capable node within the PEBOT ecosystem.

### 1. Data Layer (Room Persistence)
- **Engine:** SQLite via Room ORM.
- **Concurrency:** Coroutine-based asynchronous I/O using `Dispatchers.IO`.
- **Integrity:** `ForeignKey` constraints with `CASCADE` deletes for recipes and categories.
- **Migration:** Destructive migration enabled during rapid feature parity phase; structured migrations required for production.

### 2. Business Logic (ViewModel + StateFlow)
- **Reactive Streams:** `Flow<T>` and `StateFlow<T>` for real-time UI updates.
- **Costing Engine:** Automatic calculation of `capitalCost` using `SUM(ingredient.cost * recipe.quantity)`.
- **Inventory Protection:** POS logic verifies ingredient availability before order commitment.

### 3. Presentation (Jetpack Compose)
- **Theme:** "Premium Native" Moss Green / Paper palette.
- **Navigation:** Single-activity architecture with `navigation-compose`.
- **State Management:** Hoisted state with `collectAsStateWithLifecycle()`.

### 4. Technical Constraints
- **Minimum SDK:** 26 (Android 8.0).
- **Target SDK:** 34 (Android 14).
- **Language:** Kotlin 2.0 (JVM 21).
