# kitchen-customer-messages

*Created 2026-08-16. This describes what the software should do, in plain language.
It contains no technology. If you find yourself writing a product or library name
here, it belongs in `plan.md` instead.*

## What this is for

A customer can already send a message about their order — typed or recorded with
their voice — from the page that shows their order. Today only the front counter
staff can see those messages and answer them, on the Live Orders screen. The
kitchen, where the people actually making the order are, only gets a short
"follow-up" chime: it never shows what the customer actually said, and the kitchen
cannot answer.

This change brings the conversation into the kitchen: kitchen staff can see what
the customer wrote or said, and type an answer back. The customer sees that answer
on their order page. No more running to the front counter to ask "what did this
customer want?"

## Who uses it

- **Customers** — send a message about their order (typed or voice), and read the
  reply from the kitchen. They can only message while their order is still in
  progress.
- **Kitchen staff** — see customer messages for the orders in front of them on the
  kitchen screen, hear a sound when one arrives, and type a reply. They can also
  play back a customer's voice message. Only a staff member who is signed in can
  send a reply — the screen alone cannot.
- **Front counter staff** — keep everything they can do today on the Live Orders
  screen. This change does not take anything away from them.

## What it does

- Show a customer's message on the kitchen screen, attached to their order, the
  moment it arrives, with a sound so it is not missed.
- Mark an order card on the kitchen screen as having a message that has not been
  answered yet, so it stands out at a glance.
- Let kitchen staff open a message thread for an order and read the whole
  back-and-forth — customer and staff messages in order.
- Let kitchen staff play a customer's voice message.
- Let signed-in kitchen staff type a reply, which the customer sees on their order
  page.
- Keep the front counter screen's messaging working exactly as it does today.

## What it does not do

- No voice replies from staff — staff answers are typed only. (Customers can still
  record voice messages.)
- No editing or deleting a message once it is sent.
- No messages after an order is finished — as today, the conversation closes when
  the order is completed or cancelled.
- No alerting outside the app (no email, no phone notification) when a message
  arrives.
- This change does not touch who can see the kitchen screens overall — that stays
  as it is today.

## Rules the business cares about

- A customer can only send a message while their order is still in progress.
- A message belongs to exactly one order, and staff see it attached to that order —
  never mixed with another customer's.
- When the kitchen replies, the customer must see it as coming from the cafe, and
  it must be clear it is a real answer from staff.
- Only a signed-in staff member can reply to a customer. Someone who just finds the
  kitchen screen — a curious customer, a stranger — can read messages but cannot
  answer them as the cafe.

## How we'll know it works

- When a customer sends a message on their order page, then it appears on the
  kitchen screen with a sound and the customer's words.
- When the kitchen types a reply to a customer's message, then the customer sees
  that reply on their order page.
- When a customer sends a voice message, then the kitchen can play it on the
  kitchen screen.
- When an order card on the kitchen screen has a message that has not been
  answered yet, then it shows a clear "message waiting" marker.
- When I open an order on the kitchen screen, then I can read the whole
  back-and-forth — customer and staff — in the order it happened.

## Still to clarify

None. The open question about who may reply from the kitchen was settled: only a
signed-in staff member.

## Ideas for later

- Staff voice replies, if it turns out typing is too slow on the floor.
- Letting the kitchen mark a message as "handled" once they've dealt with it, so
  the waiting marker clears even before they reply.
- A customer status line on the order page ("the kitchen has read your message")
  so customers know they haven't been ignored.