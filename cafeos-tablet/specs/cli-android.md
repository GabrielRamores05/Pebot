# CLI Reference: PEBOT Tablet Terminal

The "System Console" screen provides a GUI wrapper for common CLI operations required for system maintenance.

## Available Commands

### `pebot init`
- **Internal:** `viewModel.seedData()`
- **Action:** Clears business tables and populates with reference categories, products (Americano, Latte), and base ingredients.

### `pebot doctor`
- **Internal:** `viewModel.runDiagnostics()`
- **Action:** 
    - Verifies DB connection integrity.
    - Checks for ingredients with null cost values.
    - Validates POS peripheral availability.

### `pebot db backup`
- **Internal:** `viewModel.backupDatabase()`
- **Action:** Triggers a Room checkpoint and exports the SQLite file to external storage for archival.

## Compliance
All CLI operations must be wrapped in `viewModelScope` and handle exceptions without terminating the UI process.
