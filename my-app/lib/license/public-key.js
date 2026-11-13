// @ts-check
'use strict';
// The seller's Ed25519 PUBLIC key. It can only check license keys, never create
// them, so it is safe to ship. It is written by `pebot-keygen init`
// (tools/pebot-keygen). While it is null, every key is rejected with
// "not-configured" and Pebot stays locked (fail closed, constitution VIII).

/** @type {string | null} */
const PUBLIC_KEY_PEM = null;

module.exports = { PUBLIC_KEY_PEM };
