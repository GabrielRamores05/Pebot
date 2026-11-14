# Pebot setup guide (for the restaurant)

One page, in the order you do it. Takes about an hour.

## 1. The main PC
- Windows 10 or 11, 8 GB memory or more, an SSD.
- This PC runs Pebot for everyone. Tablets, the kitchen screen and phones all
  connect to it, so keep it **on during service** and plug it into a UPS
  (a small battery backup) so a brownout does not stop the restaurant.
- Install Pebot, open it, and send the **machine code** shown on screen to your
  seller. Type the license key you get back. Pebot stays locked until then.

## 2. Wi-Fi: keep guests apart
- Use **two Wi-Fi networks**: one for staff devices and the main PC, one for
  guests (most routers call this "Guest network").
- Guests who order by QR code still need to reach the main PC. If your router
  cannot do that, put guests on the staff network but **give every staff member
  a PIN and every manager a different PIN**, and never write PINs near the register.
- Give the main PC a **fixed address** in the router (DHCP reservation) so
  tablets and QR codes keep working after a restart.

## 3. Printers and cash drawer
- Install the printer's **Windows driver** first and print a Windows test page.
- In Pebot: Settings → Printing. Pick the receipt printer, the kitchen printer
  and the paper width (58 mm or 80 mm). Print a test invoice and a test kitchen ticket.
- A cash drawer plugged into the receipt printer opens when the driver is set to
  "open drawer before/after printing" (in the printer's Windows settings).
  Check this before opening day.

## 4. Backups (do not skip)
- Settings → Account & Data → Automatic daily backup. Plug in a **USB stick that stays in
  the PC**, type its folder (for example `E:\PebotBackups`) and press
  **Back up now**. You should see "Backed up to 2 places".
- Once a month, copy the newest backup file to Google Drive or another PC.
- To restore: Settings → Account & Data → Restore Data, and pick a `.db` file.

## 5. Your business details
- Settings → Business: name, address, TIN, VAT-registered or not, service
  charge (and for which order types).
- **BIR:** Pebot is not BIR-accredited. Its invoices print "This is not an
  official receipt" until you enter a BIR Permit to Use number. Keep issuing
  your BIR-registered receipts until then. Ask your accountant.

## 6. Staff
- Staff & HR → add each person, their pay (hourly or monthly) and a 4–6 digit PIN.
- Managers (owner, manager, supervisor) can approve voids and refunds with their PIN.
- Staff clock in and out from the sidebar. Payroll uses those times.
- Check Staff & HR → Schedule → Holidays each January and add the holidays the
  President proclaims (Eid, Chinese New Year and others).
- When SSS, PhilHealth, Pag-IBIG or BIR change their rates, update them in
  Staff & HR → Payroll → Government rates (your accountant can tell you the new numbers).

## 7. Menu and stock
- Products → add categories and dishes with prices. Import from a spreadsheet if you have one.
- Inventory → add ingredients with their cost, then attach recipes to dishes so
  stock goes down by itself.
- Do a **Stock count** every week and **Log waste** every day. The profit report uses both.

## 8. Opening day checklist
- [ ] License active
- [ ] Test sale printed on the receipt printer, ticket printed in the kitchen
- [ ] Cash drawer opens
- [ ] A Senior Citizen sale checked by your accountant
- [ ] A void with a manager PIN
- [ ] Open the cash drawer in Pebot with your starting cash; close it at night
      and print End of Day
- [ ] Backup shows today's date

## 9. Updates
- When the main PC is online, Pebot checks for a new version every few hours.
  The owner sees a bar at the top: **Pebot 1.x is available → Download**.
  Settings → Account & Data → Updates shows your version and has **Check now**.
- Download the installer and run it on the main PC after closing time. Your data,
  license and settings stay. Back up first (Settings → Account & Data → Back up now).
