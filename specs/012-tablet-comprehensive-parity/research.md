# Research: Tablet Parity Decisions

## Decisions

### D1: Socket.IO vs REST polling for real-time sync
**Decision**: Socket.IO (2.5.1)
**Rationale**: Windows app already uses Socket.IO (Per Appendix, Constitution §4). Tablet must follow same pattern. Real-time order updates require push, not polling. Offline-first: sync reconnects automatically.
**Alternatives considered**: REST polling (higher latency, battery drain), GraphQL subscriptions (not in stack)

### D2: PDF via Android PrintManager for receipts
**Decision**: `androidx.print:print` + PDF generation via `android.graphics.pdf.PdfDocument`
**Rationale**: BIR-compliant receipts require precise layout control. Canvas-based PDF meets formatting requirements. PrintManager handles Bluetooth/USB printer routing.
**Alternatives considered**: Direct ESC/POS commands (requires printer driver library), HTML-to-PDF (heavier, WebView dependency)

### D3: Room database schema alignment
**Decision**: Mirror Windows Prisma schema as closely as possible using Room `@Entity` and `@Relation`
**Rationale**: Sync protocol sends JSON; schema alignment minimizes transformation logic. Room supports same SQLite features (foreign keys, indices, constraints).
**Alternatives considered**: Separate sync model with mapping layer (adds complexity, more code to maintain)

### D4: Staff authentication approach
**Decision**: 6-digit PIN with role-based access, default fallback PIN `123456` for first-time setup
**Rationale**: Tablet use case is kiosk-style; PIN faster than username/password typing. Matches Windows staff auth pattern.
**Alternatives considered**: Biometric auth (not all tablets have fingerprint), full password (too slow for POS)

### D5: In-memory product cache
**Decision**: HashMap-based cache in ViewModel (not StateFlow)
**Rationale**: POS screen needs sub-200ms lookups; DB flow collection is async. Cache populated once from `getAllProducts()` flow. Acceptable memory trade-off for 50-200 products.
**Alternatives considered**: Room `@Relation` (adds join overhead), Redis (unnecessary for local-only)

### D6: Offline-first sync strategy
**Decision**: Socket.IO with event replay queue
**Rationale**: Constitution Principle I requires offline always. Tablet writes to local Room DB; on reconnect, syncs changes to server via `order_placed`, `inventory_changed` events. Server pushes updates to other clients.
**Alternatives considered**: Conflict-free replicated data types (CRDTs) (over-engineering for single-location), full DB sync on reconnect (too slow)

### D7: Navigation architecture
**Decision**: Single-activity with Jetpack Navigation Compose
**Rationale**: Matches current architecture. Tab-based NavigationRail for tablet screen real estate.
**Alternatives considered**: Multi-activity (more Android boilerplate), bottom navigation (not enough screen space on larger tablets)

## Open Questions

| Q1 | Should HR payroll calculations live on-device or server-side? |
|----|------|
| | **Decision**: On-device — matches local-first principle. SSS/Philhealth/Pag-IBIG tables stored in Room. |

| Q2 | How to handle schema version conflicts between web and tablet? |
|----|------|
| | **Decision**: Versioning + migration scripts. Tablet DB version >= web schema version. Migrations additive only (Principle III). |

| Q3 | Should AI Consultant be on-device LLM or web API? |
|----|------|
| | **Decision**: Web API via localhost (Electron server). Tablet acts as client to local server's `/api/consultant` endpoint. No on-device LLM — violates local-first if internet required. |

## References
- Constitution v1.0.0 (`.specify/memory/constitution.md`)
- PEBOT_MASTER_PROMPT.md (archive reference)
- Existing tablet implementation (Phases 1-6 completed)
