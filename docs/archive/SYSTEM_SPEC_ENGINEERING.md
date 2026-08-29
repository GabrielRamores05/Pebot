# CaféOS System Specification Engineering Document

## 1. Document Purpose

This document defines the system-wide specification for the CaféOS project as it currently exists in this repository. It is intended to serve as a baseline for product engineering, implementation planning, QA, and iteration.

The purpose of this spec is to capture the totality of the system across:

- POS transactions and cashier operations
- Kitchen and fulfillment flow
- Customer ordering and QR-based self-service
- Staff and admin roles
- Inventory and product management
- Loyalty, rewards, and vouchers
- Reporting and operational analytics
- Infrastructure, deployment, and local-first architecture

This is a working, system-level specification grounded in the current codebase, not a generic café app template.

---

## 2. System Overview

CaféOS is a local-first coffee shop and restaurant management system built with Next.js and Prisma, designed to operate on a local Wi-Fi network without requiring internet access for core functionality. The system supports both in-store POS operations and customer-facing QR ordering flows, while also exposing admin dashboards for operational control.

The platform is intended for small-to-medium coffee shops, cafes, and quick-service food businesses that require:

- fast-ordering workflows
- table and dine-in management
- kitchen coordination
- loyalty program tracking
- inventory and stock visibility
- local deployment in an on-premise environment
- modular expansion for business operations

---

## 3. Business Context and Scope

### 3.1 Core Business Goals

1. Reduce checkout friction for cashier staff.
2. Allow customers to order without direct staff intervention.
3. Manage dine-in, takeout, and delivery flows cleanly.
4. Track sales, product movement, and operational performance.
5. Reward repeat customers through loyalty and voucher mechanics.
6. Run locally without dependency on cloud availability for core operations.
7. Support admin-level management of products, inventory, orders, and store settings.

### 3.2 In-Scope Domains

- Product catalog and category management
- POS checkout
- Order lifecycle
- Table management
- Kitchen and fulfillment operations
- Staff access control and permissions
- Inventory and ingredient tracking
- Loyalty and promotional mechanics
- Payments and transaction tracking
- Business settings and BIR-compliant invoice metadata
- Reporting and analytics

### 3.3 Out-of-Scope / Future Scope

- Multi-branch enterprise orchestration across many independent stores
- External payment gateway integrations beyond recorded methods
- Advanced ERP integrations
- Employee payroll and HR management
- Customer account login outside store operations
- SaaS cloud hosting as the default deployment model

---

## 4. User Roles and Personas

### 4.1 Admin

Responsible for:

- system setup
- product configuration
- staff creation and role assignment
- permissions governance
- subscription and license controls
- loyalty settings and store configuration
- analytics review

### 4.2 Staff / Cashier

Responsible for:

- processing customer orders
- handling payment and change
- generating receipts / completion states
- table assignment and handoff
- operational support at the point of sale

### 4.3 Kitchen / Barista

Responsible for:

- reviewing incoming orders
- preparing and marking items as fulfilled
- coordinating with front-of-house staff

### 4.4 Customer

The customer persona interacts primarily in:

- on-premise QR ordering
- dine-in ordering
- loyalty card redemption
- voucher usage and reward accrual

### 4.5 Manager / Owner

Responsible for:

- performance visibility
- revenue tracking
- stock control
- decisions on promotions and menu pricing

---

## 5. Functional Modules

## 5.1 POS and Ordering Module

This is the operational core of the system.

Capabilities include:

- creating orders from cashier workflow
- selecting order type: Dine-in, Takeout, Delivery
- attaching table information where required
- adding products to cart
- editing quantities and notes
- applying payment methods
- calculating totals and change
- confirming order completion

Expected behavior:

- one order type is the source of truth
- table selection is only required for dine-in flows
- totals must be consistent across cart and order summary
- payment logic should be explicit and avoid ambiguous zero-state behavior

---

## 5.2 Product Catalog Module

The system supports product records with classification and pricing metadata.

Each product includes:

- name
- description
- price
- category
- image URL
- availability state
- preparation time
- station type
- ingredients and inventory linkage
- pricing configuration for BIR / business accounting logic

The product model also includes fields for:

- capital cost
- margin type
- margin value
- VAT exemption status

These are used to support restaurant pricing accuracy and compliance-related reporting.

---

## 5.3 Inventory and Ingredient Module

This module manages stock levels of ingredients and products.

Inventory includes:

- product stock quantity
- low-stock threshold
- unit of measure
- last update tracking

Ingredient records support:

- base unit identity for purchase/inventory logic
- cost per unit
- minimum stock threshold
- supplier metadata

This is designed around ingredient-driven product operations and purchasing discipline.

---

## 5.4 Table and Floor Management

The system supports dining tables as tracked operational assets.

Table fields include:

- name
- capacity
- status
- section
- coordinates for floor-plan layout
- entry and occupancy metadata
- assigned order reference

The table lifecycle supports:

- availability checks
- occupancy tracking over time
- guest session tracking
- dining analytics based on dwell time

---

## 5.5 Kitchen and Fulfillment Module

CaféOS includes dedicated operational flows for preparation and fulfillment.

This includes:

- order queue management
- preparation station awareness
- status progression of order items
- customer follow-up messages
- kitchen-facing visibility of active orders

This module ensures the back-of-house team sees the correct preparation state while the front-of-house team handles service.

---

## 5.6 Loyalty Module

The loyalty system is a major product component and supports a flexible reward model.

### 5.6.1 Loyalty Settings

Per-category loyalty settings allow configuration of:

- required number of purchases for reward
- reward type (free, percentage, fixed amount)
- reward value
- milestone mode
- milestone definitions
- card branding data

### 5.6.2 Loyalty Cards

A loyalty card tracks:

- customer name
- membership code
- category affiliation
- paid item count
- milestone claims
- vouchers issued

### 5.6.3 Loyalty Vouchers

Voucher support includes:

- code generation
- discount type and value
- min purchase requirements
- maximum redemptions
- validity rules including day-of-week rules
- product/category targeting logic
- active vs redeemed vs expired state

### 5.6.4 Reward History

The system records:

- earned actions
- redeemed actions
- expired actions
- related order references
- notes for transparency

---

## 5.7 Payment and Transaction Module

Payment is handled through recorded payment transactions linked to an order.

Supported payment method metadata includes:

- cash
- GCash
- bank transfer
- card-based internal handling conventions

Transaction states include:

- pending
- completed
- failed
- refunded

The model supports reference numbers and processing timestamps, with the intent of supporting local and hybrid payment reconciliation.

---

## 5.8 Admin and Settings Module

Admin features include:

- user management
- subscription and tier configuration
- POS license management
- business information configuration
- general system settings
- role-based access to modules

Settings are stored using a key-value pattern and business metadata is persisted separately for print/invoice configuration.

---

## 6. Technical Architecture

## 6.1 Frontend

The application is built with:

- Next.js
- React
- TypeScript
- Tailwind CSS
- App Router structure under the app directory

This indicates a modern, component-driven UI architecture built for rapid feature iteration and modular pages.

## 6.2 Backend / API Layer

The app includes multiple route groups under app/api, supporting modules such as:

- auth
- analytics
- categories
- files
- ingredients
- inventory
- loyalty
- orders
- payments
- products
- reviews
- settings

This suggests a route-based API structure fused into the same Next.js app, allowing a self-contained local deployment architecture.

## 6.3 Data Layer

The database layer is driven by Prisma with SQLite.

Key characteristics:

- SQLite for local single-machine deployment
- Prisma schema as the source of truth for system entities
- generated client stored in lib/prisma-client
- seed scripts for bootstrapping default data

## 6.4 Local-First Deployment Pattern

The project is intentionally designed for local operation using:

- local database
- local file assets
- local network exposure
- Electron packaging support for desktop use

The presence of Electron configuration and local build scripts indicates that the system may be deployed both as:

- a web app on a local network
- a desktop application bundle

---

## 7. System Data Model Highlights

The central entities in the system are:

- User
- Subscription
- POSLicense
- Category
- Product
- Ingredient
- ProductIngredient
- RestaurantTable
- TableSession
- Order
- OrderItem
- OrderMessage
- Inventory
- Setting
- BusinessSettings
- LoyaltySetting
- LoyaltyCard
- LoyaltyVoucher
- RewardHistory
- PaymentTransaction
- TableGuest
- StaffStationControl

These are not isolated features — they form a connected business process model in which a product, an order, a payment, a table, and a loyalty reward all participate in the same operational flow.

---

## 8. Core Business Flows

## 8.1 Order Flow

1. Customer selects or is assigned to a table / order type.
2. Cashier or customer selects products.
3. Cart is assembled with notes/quantities.
4. Order is validated and confirmed.
5. Payment is collected.
6. Status transitions begin for kitchen/fulfillment.
7. Order is marked complete or cancelled.

## 8.2 Dine-In Flow

1. Customer sits at a table.
2. Table is marked occupied.
3. Dine-in order is created.
4. Items are served or prepared.
5. Settlement occurs and table status resets as needed.

## 8.3 Takeout / Delivery Flow

1. Order type is set to Takeout or Delivery.
2. Address or pickup context is attached when applicable.
3. Payment is processed.
4. Order moves to fulfillment.
5. Completion and handoff follow.

## 8.4 Loyalty Flow

1. Customer uses a loyalty card or name linkage.
2. Orders contribute to paid item counts.
3. Rewards are generated or milestone thresholds are reached.
4. Voucher is issued and stored for redemption.
5. Voucher is applied at payment or order stage.
6. Redemption is logged in history.

---

## 9. Non-Functional Requirements

### 9.1 Performance

- POS interactions should feel immediate on local hardware.
- Cart updates and order actions must be responsive.
- The interface should support quick multi-tap behavior in rush periods.

### 9.2 Reliability

- Local-only operation should not depend on continuous internet access.
- Orders and transactions should be persisted reliably in the local database.
- Failure states must be explicit and recoverable.

### 9.3 Usability

- Tap targets should be large enough for fast retail usage.
- Product and order states must be visually clear.
- Cashier workflows must minimize ambiguity.

### 9.4 Accessibility

- Inputs and controls should have strong contrast.
- Focus states should be visible.
- Motion should respect reduced-motion preferences.
- Actions should be explicit, not hidden behind ambiguous states.

### 9.5 Security and Access Control

- Roles and permissions are central to user access.
- Admin-level functions must be separated from cashier operation.
- Authentication is required for secure app access.

---

## 10. Permissions and Access Model

The user model includes permissions as a JSON permission structure and a role string.

Typical role categories:

- ADMIN
- STAFF
- KITCHEN

The permissions object suggests module-level access toggles for:

- live orders
- terminal
- tables
- analytics
- products
- inventory
- kitchen
- loyalty
- staff
- settings

This means the system is designed to support role-sensitive access rather than a single all-access operator model.

---

## 11. Regulatory and Business Metadata

The presence of BIR-compliant business settings indicates that the system was designed with local compliance concerns in mind.

Included metadata includes:

- business name
- address
- TIN
- branch code
- VAT rate
- receipt serial prefix
- last receipt number
- footer message

This is especially relevant for business operations in the Philippines and indicates a stronger accounting / receipt compliance lens than a generic café app.

---

## 12. Assumptions and Constraints

### Assumptions

- The business is operating in a local environment, not a cloud-native SaaS environment.
- The system is intended for a single store or a small network of local devices.
- Staff operate through a shared local system rather than many separate remote services.
- Offline resilience is important.

### Constraints

- SQLite is used instead of a full enterprise database.
- The app remains a single project with integrated API routes and UI.
- Local asset and file handling are necessary for image upload and order data.
- Security model is modest but structured around roles and permissions.

---

## 13. Risks and Gaps

Potential system-level concerns include:

- permission logic may drift from actual UI flows if not kept synchronized
- loyalty rules may become over-complex without clear validation
- inventory + product pricing logic may need stronger calculations and reconciliation
- local deployment may require operational tooling for backups and restore
- analytics and reporting could become inconsistent if business rules are not standardized

---

## 14. Operational Requirements

The system should support operational discipline in a real café environment:

- multiple staff can operate in a shared local environment
- order, inventory, loyalty, and payment data must remain coherent
- downtime should be recoverable with local database backups
- kitchen and cashier workflows must remain distinct but synchronized
- customer-facing ordering should not interfere with in-store POS actions

---

## 15. Acceptance Criteria for the Whole System

The overall project should be considered successful when the following are true:

- cashier and dine-in flows are unambiguous
- order totals are accurate and consistent across UI components
- product, inventory, and pricing data remain coherent
- kitchen and front-of-house workflows are synchronized
- staff permissions are enforced correctly
- loyalty rules are calculable and traceable
- table state and occupancy are accurately represented
- all payment transactions are linked to corresponding orders
- business settings support local operational compliance
- the app can run locally as a practical day-to-day café operating system

---

## 16. Recommended Engineering Next Steps

1. Define a canonical functional requirements matrix by module.
2. Validate every route and feature against the Prisma schema.
3. Separate the app into clear operational modules with explicit owners.
4. Lock down data invariants for orders, inventory, loyalty, and payment logic.
5. Create a release checklist for local deployment and reset procedures.
6. Define a QA matrix covering cashier, kitchen, loyalty, and admin flows.
7. Turn this document into a product backlog with user stories and acceptance tests.

---

## 17. Summary

CaféOS is a local-first restaurant and coffee shop operations system combining POS, kitchen, loyalty, inventory, and admin capabilities in a single application architecture. The codebase already reflects a substantial operational system rather than a starter app. This specification acts as the system-wide baseline for engineering decisions, implementation priorities, and future iterations.

This document should be treated as the foundation for deeper spec engineering, user story decomposition, and delivery planning.
