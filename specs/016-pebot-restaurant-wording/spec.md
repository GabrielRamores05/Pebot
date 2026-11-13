# Feature Specification: Pebot Name and Restaurant Wording

**Feature Branch**: `016-pebot-restaurant-wording`

**Created**: 2026-11-14

**Status**: Implemented

**Input**: User description: "This should not only be made for coffee shops. It focuses on POS, so restaurant owners are the target." The product is sold as Pebot (spec 015), but the app still calls itself CaféOS and talks about coffee throughout. The Android tablet app is a separate product and is out of scope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A restaurant owner sees "Pebot", not a coffee-shop product (Priority: P1)

A carinderia or fast-food owner who bought Pebot installs it and sees the name Pebot on the installer, desktop shortcut, window title, sign-in screen and browser tab. Nothing tells them the product is for coffee shops.

**Why this priority**: The product is sold as Pebot to restaurants. A buyer who sees "CaféOS – Smart Coffee Shop POS" will think they received the wrong software.

**Independent Test**: Search every screen and printed output of a fresh install for "CaféOS", "CafeOS" and "coffee shop". None appear.

**Acceptance Scenarios**:

1. **Given** a fresh install, **When** the owner opens Pebot, **Then** the window title, tray menu, sign-in screen, home screen and browser tab say "Pebot".
2. **Given** a restaurant that has not yet set its business name, **When** a receipt or report is shown, **Then** the placeholder name is "My Restaurant", not "CaféOS Coffee Shop".
3. **Given** the owner prints the customer QR poster, **When** it prints, **Then** it is titled with the restaurant's own name, not the software's name.
4. **Given** the AI consultant, **When** the owner opens it, **Then** it introduces itself as "Pebot Assistant" and talks about restaurant management.

---

### User Story 2 - Loyalty and staff screens fit any food business (Priority: P1)

A restaurant runs a loyalty card on its meals, not on coffee. Loyalty screens and messages talk about "stamps" and "rewards" instead of "coffees" and "free coffee". Staff positions and kitchen stations include restaurant roles.

**Why this priority**: Customers read these messages on their own phones. "You need 3 more coffees" in a restaurant that sells no coffee looks broken.

**Independent Test**: Register a loyalty card, add progress, claim a reward and read every message. None mention coffee.

**Acceptance Scenarios**:

1. **Given** a customer joins the loyalty program, **When** they register, **Then** the welcome message says how many stamps earn a reward.
2. **Given** a customer has no reward yet, **When** they try to claim, **Then** the message says how many more stamps they need.
3. **Given** the owner adds a staff member, **When** they pick a position, **Then** Server and Cook are offered alongside Cashier, Kitchen Staff, Barista, Shift Supervisor and Manager.
4. **Given** the kitchen stations, **When** they are listed, **Then** the drinks station is labelled "Drinks", not "Coffee".
5. **Given** revenue analytics, **When** loyalty impact is calculated, **Then** it counts rewards on whichever menu categories the loyalty program covers, not only a category named "coffee".

---

### User Story 3 - An existing install keeps its data after the rename (Priority: P1)

A location that already runs the software under the old name installs the renamed version. All of its orders, menu, staff and settings are still there, and staff stay signed in.

**Why this priority**: Constitution Principle VII: no silent data loss. The desktop app stores data in a folder named after the app, so a careless rename would make existing data appear to vanish.

**Independent Test**: Start the renamed app on a machine that has a database in the old data folder. It uses that folder.

**Acceptance Scenarios**:

1. **Given** data from the old name exists, **When** the renamed app starts, **Then** it uses the existing data and creates no empty database.
2. **Given** a fresh machine, **When** the renamed app starts, **Then** it creates its data under the new name.
3. **Given** the Android tablet app (a separate product), **When** it looks for the main PC on the network, **Then** it still finds it exactly as before.

### Edge Cases

- **A restaurant that typed "CaféOS" as its own business name.** Stored business names and loyalty card text are the owner's data and are never rewritten.
- **Old backups.** Backups made before the rename still restore.
- **Sign-in sessions and saved carts.** Names that only the software sees (sign-in cookie, saved-cart keys, database file, backup file names, network service name) do not change, so nobody is signed out and nothing is lost.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every place the software names itself to a person MUST say "Pebot": installer, shortcut, window titles, tray menu, sign-in and home screens, browser tab title, installable-app name, error dialogs, and the voice assistant test phrase.
- **FR-002**: Default and placeholder business names MUST be "My Restaurant".
- **FR-003**: Printed and downloaded customer QR posters MUST be titled with the restaurant's own name.
- **FR-004**: The AI consultant MUST be named "Pebot Assistant", and its default instructions MUST describe restaurant management.
- **FR-005**: Loyalty text shown to customers and staff MUST use "stamps" and "reward" instead of "coffees" and "free coffee". The default reward name MUST be "Free Item".
- **FR-006**: The staff position list MUST add Server and Cook and MUST keep every existing position.
- **FR-007**: The drinks kitchen station MUST be labelled "Drinks". Its stored identifier MUST NOT change.
- **FR-008**: Loyalty impact in revenue analytics MUST be computed from the categories the loyalty program covers.
- **FR-009**: The renamed desktop app MUST keep using an existing data folder from the old name when one holds a database.
- **FR-010**: Internal names MUST NOT change: sign-in cookie, saved-data keys, database and backup file names, network service name and advertised details, and anything the tablet app relies on.
- **FR-011**: Data the owner entered (business name, loyalty card titles and descriptions, product and category names) MUST NOT be rewritten.
- **FR-012**: No feature is removed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 occurrences of "CaféOS", "CafeOS" or "coffee shop" in any screen, message or printout of a fresh install.
- **SC-002**: 0 loyalty messages mention coffee.
- **SC-003**: 100% of existing data is present after updating an install that used the old name.
- **SC-004**: The tablet app and already-printed table QR codes keep working with no change on their side.

## Assumptions

- The loyalty unit is called "stamps". This is the common word for card-style programs. It is a naming choice the owner can change with a one-word edit.
- The hostname other devices use (`smartcafeos.local`) is unchanged, so printed QR codes keep working. Changing it is a separate decision.
- Sample menu items in developer-only seed data are not customer-facing and are left as they are.
- The welcome page gets a full redesign in a later spec. Here it only stops mentioning coffee.
- The tablet import screen keeps the tablet product's own name.
- Restaurant money features (Senior Citizen and PWD discount with VAT exemption, service charge, cash drawer and end-of-day reports) are a separate spec, 017.
