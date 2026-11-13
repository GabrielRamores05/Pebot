// Keep existing data after the CaféOS → Pebot rename (spec 016, constitution VII).
//
// Electron derives the data folder from the app name. An install from before the
// rename left its database under the old name; that folder must keep being used
// instead of starting again with an empty database.
const path = require('path');

const DB_FILE = 'cafeos.db';
const LEGACY_NAMES = ['CaféOS', 'cafeos'];

/**
 * @param {{ current: string, appData: string, exists: (file: string) => boolean }} ctx
 * @returns {string} the folder the app should store its data in
 */
function pickUserDataDir({ current, appData, exists }) {
  if (exists(path.join(current, DB_FILE))) return current;
  for (const name of LEGACY_NAMES) {
    const legacy = path.join(appData, name);
    if (legacy.toLowerCase() === current.toLowerCase()) continue;
    if (exists(path.join(legacy, DB_FILE))) return legacy;
  }
  return current;
}

module.exports = { pickUserDataDir };
