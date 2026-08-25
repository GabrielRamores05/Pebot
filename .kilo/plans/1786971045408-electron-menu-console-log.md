# Plan: Add Console Log Menu Item to Electron App Menu

## Goal
Add a "Console Log" menu item in the native Electron app menu bar (beside "Window") that opens a window displaying the application log file (`%APPDATA%\cafeos\cafeos.log`) for debugging.

## Current Menu Structure (electron/main.js:306-340)
- **CafeOS** - Navigation items (Home, Admin POS, Kitchen, etc.)
- **View** - Reload, zoom, fullscreen
- **Window** - Minimize, zoom, close

## Implementation Steps

### 1. Add "Console Log" Menu Item
**File:** `my-app/electron/main.js`  
**Function:** `buildAppMenu()`  
**Change:** Add new menu entry after "Window" section:
```javascript
{
  label: 'Console Log',
  click: () => openLogWindow()
}
```

### 2. Create `openLogWindow()` Function
**File:** `my-app/electron/main.js`  
**New function** that:
- Creates a new `BrowserWindow` (e.g., 800x600, titled "CafeOS - Console Log")
- Loads a simple HTML page that reads and displays the log file
- Uses `fs.readFileSync(LOG_FILE, 'utf-8')` to get log content
- Auto-refreshes every 2-3 seconds
- Shows timestamps, error levels, with syntax highlighting

### 3. Log File Path
Already defined at line 24:
```javascript
const LOG_FILE = path.join(app.getPath('userData'), 'cafeos.log');
```

### 4. Log Window UI (inline HTML)
Simple page with:
- Header: "CafeOS System Logs" + "Clear Log" button
- Content area: `<pre>` with monospace font, auto-scroll to bottom
- Color coding: `[ERROR]` red, `[WARN]` yellow, `[INFO]` blue
- Auto-refresh toggle

## Files to Modify
- `my-app/electron/main.js` - Add menu item + `openLogWindow()` function

## Validation
1. Run `npm run electron` (dev mode)
2. Click "Console Log" in app menu bar
3. Verify window opens showing `cafeos.log` content
4. Trigger an error (e.g., visit terminal page on fresh DB) and verify it appears in log window
5. Test "Clear Log" button clears the file
6. Test auto-refresh works

## Notes
- Only useful in development/debugging - consider hiding in production builds (`!isDev`)
- Log file is cleared on each app startup (line 26) - this is existing behavior
- Window should be closable without affecting main app