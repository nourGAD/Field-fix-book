/**
 * Field Fix Book – Google Apps Script backend.
 * Paste into Extensions > Apps Script of the Field Fix Book sheet,
 * then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 */
const FIX_SHEET = 'Fixes';
const STEP_SHEET = 'Steps';
const PHOTO_FOLDER = 'Field Fix Book Photos';
const FIX_HEADERS = ['id', 'createdAt', 'name', 'title', 'category', 'equipment', 'symptom', 'cause', 'steps', 'avoid', 'country', 'tags', 'photos', 'worked'];
const STEP_HEADERS = ['id', 'fixId', 'createdAt', 'name', 'text', 'photos'];
const CATEGORIES = ['Power & DC', 'RF & antenna', 'Transmission & fiber', 'Alarms & sensors', 'Integration & SW', 'Installation & HW', 'Site & environment', 'Safety'];

function setup() {
  sheet_(FIX_SHEET, FIX_HEADERS);
  sheet_(STEP_SHEET, STEP_HEADERS);
  folder_();
}

function doGet() {
  return json_(list_());
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (req.action === 'addFix') return json_({ ok: true, id: addFix_(req) });
    if (req.action === 'addStep') return json_({ ok: true, id: addStep_(req) });
    if (req.action === 'worked') return json_({ ok: true, worked: worked_(req) });
    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- actions ---------- */
function list_() {
  const fixes = rows_(sheet_(FIX_SHEET, FIX_HEADERS)).map(r => ({
    id: Number(r.id), createdAt: Number(r.createdAt) || 0, name: r.name, title: r.title, category: r.category,
    equipment: r.equipment, symptom: r.symptom, cause: r.cause,
    steps: String(r.steps || '').split('\n').filter(String), avoid: r.avoid, country: r.country,
    tags: String(r.tags || '').split(',').map(t => t.trim()).filter(String),
    photos: String(r.photos || '').split(' ').filter(String), worked: Number(r.worked) || 0
  })).filter(f => f.id && f.title);
  const steps = rows_(sheet_(STEP_SHEET, STEP_HEADERS)).map(r => ({
    id: Number(r.id), fixId: Number(r.fixId), createdAt: Number(r.createdAt) || 0, name: r.name, text: r.text,
    photos: String(r.photos || '').split(' ').filter(String)
  })).filter(s => s.fixId && s.text);
  return { ok: true, fixes, steps };
}

function addFix_(req) {
  const title = clean_(req.title, 140);
  const steps = (Array.isArray(req.steps) ? req.steps : []).map(s => clean_(s, 600).replace(/\n/g, ' ')).filter(String).slice(0, 20);
  if (!title) throw new Error('Title is required');
  if (!steps.length) throw new Error('At least one step is required');
  const sh = sheet_(FIX_SHEET, FIX_HEADERS);
  const id = nextId_(sh);
  const photos = savePhotos_(req.photos, 'FX-' + id);
  sh.appendRow([id, Date.now(), clean_(req.name, 60), title,
    CATEGORIES.indexOf(req.category) >= 0 ? req.category : CATEGORIES[0],
    clean_(req.equipment, 80), clean_(req.symptom, 2000), clean_(req.cause, 2000), steps.join('\n'),
    clean_(req.avoid, 1000), clean_(req.country, 40),
    (Array.isArray(req.tags) ? req.tags : []).map(t => clean_(t, 30)).filter(String).slice(0, 8).join(', '),
    photos.join(' '), 0].map(safe_));
  return id;
}

function addStep_(req) {
  const fixId = Number(req.fixId);
  const text = clean_(req.text, 2000);
  if (!fixId || !text) throw new Error('Step text is required');
  if (!findRow_(sheet_(FIX_SHEET, FIX_HEADERS), fixId)) throw new Error('Fix not found');
  const sh = sheet_(STEP_SHEET, STEP_HEADERS);
  const id = nextId_(sh);
  const photos = savePhotos_(req.photos, 'FX-' + fixId + '-step-' + id);
  sh.appendRow([id, fixId, Date.now(), clean_(req.name, 60), text, photos.join(' ')].map(safe_));
  return id;
}

function worked_(req) {
  const sh = sheet_(FIX_SHEET, FIX_HEADERS);
  const row = findRow_(sh, Number(req.fixId));
  if (!row) throw new Error('Fix not found');
  const col = FIX_HEADERS.indexOf('worked') + 1;
  const cell = sh.getRange(row, col);
  const value = Math.max(0, (Number(cell.getValue()) || 0) + (req.undo ? -1 : 1));
  cell.setValue(value);
  return value;
}

/* ---------- helpers ---------- */
function sheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sh;
}
function rows_(sh) {
  const values = sh.getDataRange().getValues();
  const head = values.shift() || [];
  return values.map(v => { const o = {}; head.forEach((h, i) => o[h] = v[i] === '' ? '' : String(v[i])); return o; });
}
function nextId_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return 1;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues().map(r => Number(r[0]) || 0);
  return Math.max.apply(null, ids) + 1;
}
function findRow_(sh, id) {
  const last = sh.getLastRow();
  if (!id || last < 2) return 0;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (Number(ids[i][0]) === id) return i + 2;
  return 0;
}
function folder_() {
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
}
function savePhotos_(list, prefix) {
  if (!Array.isArray(list) || !list.length) return [];
  const folder = folder_();
  return list.slice(0, 3).map((p, i) => {
    const type = /^image\/(jpeg|png|webp)$/.test(p && p.type) ? p.type : 'image/jpeg';
    const bytes = Utilities.base64Decode(String(p && p.data || ''));
    if (!bytes.length || bytes.length > 5 * 1024 * 1024) return '';
    const file = folder.createFile(Utilities.newBlob(bytes, type, prefix + '-' + (i + 1)));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getId();
  }).filter(String);
}
function clean_(v, max) { return String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max); }
function safe_(v) { return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v; }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
