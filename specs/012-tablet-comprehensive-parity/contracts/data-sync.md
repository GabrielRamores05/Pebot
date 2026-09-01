# Contract: Data Sync Protocol

## Overview

The tablet and web app synchronize via Socket.IO over the café LAN. The tablet
acts as a client that both emits and listens for events.

## Connection

```
Server: socket://<web-app-local-ip>:3000
Events: Socket.IO v4 wire protocol compatible with client v2.5.1
```

## Event Registry

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `register_device` | Tablet → Server | `{deviceId, deviceType, locationId, timestamp}` | Tablet identifies itself |
| `order_placed` | Tablet → Server | `{orderId, orderNumber, tableNumber, totalAmount, status, paymentMethod, discountAmount, discountRate, discountReason, timestamp}` | Broadcast new order |
| `order_update` | Server → Tablet | `{orderId, status, tableNumber, orderNumber}` | Status changed on web |
| `inventory_changed` | Tablet → Server | `{productId, quantity, timestamp}` | Stock adjusted |
| `inventory_update` | Server → Tablet | `{productId, quantity}` | Stock changed on web |
| `sync_request` | Server → Tablet | `{type: "orders\|inventory\|products\|full_sync"}` | Request sync |
| `sync_data` | Tablet → Server | `{type, timestamp}` + optional data | Response to sync_request |

## Offline Behavior

- Tablet writes to local Room DB first
- Changes queued for sync on reconnect
- Conflicts resolved by timestamp precedence
- No sync = local-only mode (functionality intact)

## Auth

Socket.IO connections carry the same session as HTTP:
- Tablet connects with device identity (not user session)
- Server applies same role-based filtering as web API
- Admin actions require staff PIN verification on tablet
