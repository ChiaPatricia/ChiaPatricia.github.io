/**
 * The claw machine's leaderboard (luckyjiaxu.com/claw.html), kept in a Google Sheet.
 *
 * Set it up once:
 *  1. Make a new Google Sheet (https://sheets.new) and call it, say, "Claw leaderboard".
 *  2. In the sheet: Extensions → Apps Script. Replace everything in the editor with this file, and save.
 *  3. Deploy → New deployment → Select type: Web app.
 *       Execute as: Me    Who has access: Anyone
 *     Press Deploy and allow access when Google asks.
 *  4. Copy the Web app URL (https://script.google.com/macros/s/…/exec) and put it in
 *     data-board-url="…" in claw.html and zh/claw.html.
 *
 * Names and scores appear in the sheet's first tab. To take a name off the board, delete its row.
 * After editing this script, use Deploy → Manage deployments → Edit → New version, so the URL stays the same.
 */

const TOP = 20; // how many names the board shows
const MAX_NAME = 16;
const STEP = 30; // the most points one request may add (a game cannot win faster than that)
const GAP = 5; // seconds between two requests from the same player

function doGet() {
  return reply_({ top: top_() });
}

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply_({ error: 'bad request' });
  }
  const id = String(data.id || '');
  if (!/^[a-z0-9]{12,40}$/.test(id)) return reply_({ error: 'bad id' });
  const name = String(data.name || '')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
  const count = (v) => Math.max(0, Math.floor(Number(v) || 0));
  const total = count(data.total);
  const wins = count(data.wins);
  const golden = count(data.golden);

  const cache = CacheService.getScriptCache();
  if (cache.get('t' + id)) return reply_({ top: top_(), rank: rank_(id) });
  cache.put('t' + id, '1', GAP);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = sheet_();
    const values = sheet.getDataRange().getValues();
    let row = -1;
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === id) {
        row = i;
        break;
      }
    }
    const now = new Date();
    if (row < 0) {
      if (name) sheet.appendRow([id, name, Math.min(total, STEP), Math.min(wins, 10), Math.min(golden, 3), now]);
    } else {
      const r = values[row];
      const grow = (want, had, most) => Math.min(Math.max(want, Number(had) || 0), (Number(had) || 0) + most);
      sheet.getRange(row + 1, 2, 1, 5).setValues([[name || r[1], grow(total, r[2], STEP), grow(wins, r[3], 10), grow(golden, r[4], 3), now]]);
    }
  } finally {
    lock.releaseLock();
  }
  return reply_({ top: top_(), rank: rank_(id) });
}

function sheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(['id', 'name', 'points', 'wins', 'golden', 'updated']);
  return sheet;
}

function ranked_() {
  return sheet_()
    .getDataRange()
    .getValues()
    .slice(1)
    .filter((r) => r[1] && Number(r[2]) > 0)
    .sort((a, b) => b[2] - a[2] || b[3] - a[3] || a[5] - b[5]);
}

function top_() {
  return ranked_()
    .slice(0, TOP)
    .map((r) => ({ name: String(r[1]), points: Number(r[2]), wins: Number(r[3]), golden: Number(r[4]) }));
}

function rank_(id) {
  const i = ranked_().findIndex((r) => r[0] === id);
  return i < 0 ? null : i + 1;
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
