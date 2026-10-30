import 'dotenv/config';
import * as db from './db.js';
import * as cloud from './cloud.js';
import express from 'express';
// v1.10.0 — `cors` package no longer imported. The CORS-lockdown
// middleware below is intentionally custom + strict (localhost only)
// where `cors()` echoed `*` for every origin.
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
// v1.10.31 — Data-F3.1: share computeInvoiceTotals with the client so
// server-generated recurring invoices honour UTGST, cess, RCM, TDS/TCS,
// discount modes (percent / unit / with-tax), tax-inclusive back-calc,
// invoice-level discount, and round-off. Previously the recurring auto-fire
// re-implemented totals inline and silently reintroduced every bug the
// v1.10.1 extraction fixed. Same source of truth now.
import { templateTotals, clientYearToDate, nextCounterValue, startFor, numberSeriesFor, counterKeyFor, formatDocNumber, businessKeyOf, getFinancialYearLabel, INVOICE_TYPES } from './src/utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

// Port choice — we deliberately default to a high, unusual number rather than
// the conventional 3001. The 3000-range is heavily used by every other Node /
// Vite / React / Express app, dev servers, Grafana, etc., which means every
// other install would land on 3002 / 3003 / etc. and the user would be left
// guessing which URL is "theirs". 47371 is in IANA's unassigned range
// (between registered 1024-49151 and dynamic 49152-65535) and isn't claimed
// by any common software we could find. The persisted `data/port.txt` always
// wins over this default — so a single user who genuinely needs 47371 for
// something else can edit that file and we'll respect it forever.
const DEFAULT_PORT = 47371;
const PORT_FILE = path.join(__dirname, 'data', 'port.txt');

// Read the persisted port (if any) — written once on first successful start
// and every time we get bumped off our preferred port by EADDRINUSE.
const persistedPort = (() => {
  try {
    if (!fs.existsSync(PORT_FILE)) return null;
    const n = parseInt(fs.readFileSync(PORT_FILE, 'utf-8').trim(), 10);
    return (isFinite(n) && n >= 1024 && n <= 65535) ? n : null;
  } catch { return null; }
})();
const STARTING_PORT = persistedPort || DEFAULT_PORT;
const MAX_PORT_SCAN = 50; // 47371 → 47420 is enough headroom for any conceivable collision

const app = express();

// v1.10.0 — CORS lockdown. Previously `app.use(cors())` echoed
// Access-Control-Allow-Origin: *, which meant any site the user visited
// could `fetch('http://localhost:47371/api/bills')` and read/wipe all
// data. This is a local desktop-style app: legitimate callers either
// have no Origin header (same-page fetch from our own served HTML,
// browsers' XHR to localhost from about:blank tools, curl) or an
// Origin pointing at http://localhost:<port>. Everything else is
// rejected. The Vite dev server proxies /api → us so its origin is
// also localhost.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allow =
    !origin ||
    /^https?:\/\/localhost(:\d+)?$/i.test(origin) ||
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin) ||
    /^https?:\/\/\[::1\](:\d+)?$/i.test(origin);
  if (!allow) {
    return res.status(403).json({ error: 'Cross-origin request refused' });
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// v1.10.0 — Body size lowered from 50mb → 5mb. Legit invoice payloads
// are single-digit kilobytes; a full import archive with 5000 bills fits
// comfortably in 2-3mb. 50mb + wildcard CORS previously meant any site
// could OOM the Node process with a nested-JSON payload.
// v1.10.77 - except /api/local-prefs, which parses its own body (below).
const LOCAL_PREFS_ROUTE = '/api/local-prefs';
// A full backup is bigger: every invoice keeps a copy of the business
// profile, logo and signature images included, so a few hundred invoices
// with a logo passed 5mb and Restore failed with "Request body too large".
const IMPORT_ROUTE = '/api/import';
const jsonBody = express.json({ limit: '5mb' });
const importBody = express.json({ limit: '500mb' });
app.use((req, res, next) => {
  if (req.path === LOCAL_PREFS_ROUTE) return next();
  return (req.path === IMPORT_ROUTE ? importBody : jsonBody)(req, res, next);
});

// Only port.txt and errors.log live on disk now; everything else is in MongoDB / Cloudinary.
fs.mkdirSync(DATA_DIR, { recursive: true });

// v1.10.0 — Path-traversal-safe user-string → single path segment.
// Strips path separators, drive letters, and every `..` occurrence
// (including URL-encoded variants after decode). Used for the
// save-pdf / trash-pdf endpoints that construct paths from query
// params. Never returns an empty string; falls back to a sentinel so
// callers can trust the return value for `path.join`.
function safePathSegment(input, fallback = 'Untitled') {
  if (input === undefined || input === null) return fallback;
  let s;
  try { s = decodeURIComponent(String(input)); } catch { s = String(input); }
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  s = s.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-');    // reserved/control chars
  s = s.replace(/\.{2,}/g, '-');                    // squash .. and ...
  s = s.replace(/^[.\s]+|[.\s]+$/g, '');            // trim leading/trailing . and space (Windows reserves)
  s = s.slice(0, 120);                              // cap length
  return s || fallback;
}

// v1.10.0 — Generic error response helper. Never returns raw Node
// error messages to the client (they leak absolute filesystem paths,
// EACCES/EPERM strings that hint at server structure). Server-side
// logs the full detail; client sees a stable code + generic phrase.
function errRes(res, status, code, err) {
  if (err) {
    try {
      const ts = new Date().toISOString();
      const msg = err && err.stack ? err.stack : String(err);
      fs.appendFileSync(ERRORS_LOG, `[${ts}] [api:${code}] ${msg}\n`, 'utf-8');
    } catch { /* ignore log failures */ }
  }
  const MESSAGES = {
    'bad-request': 'Invalid request',
    'not-found': 'Not found',
    'conflict': 'Conflict with existing resource',
    'server-error': 'Internal server error',
    'forbidden': 'Refused',
    'invalid-path': 'Invalid path',
    'payload-too-large': 'Request body too large',
  };
  return res.status(status).json({ error: MESSAGES[code] || code, code });
}

// v1.10.0 — Atomic file write. Writes to `<file>.tmp` then renames
// over the target so a mid-write crash / power loss cannot leave a
// truncated file on disk. Critical for META_PATH which stores the
// invoice counter — a truncated meta.json read back as `{}` reissues
// invoice numbers from zero.
function writeFileAtomic(filePath, contents) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, contents, 'utf-8');
  fs.renameSync(tmp, filePath);
}

// Errors log path — declared here so errRes() can find it. The actual
// file is created lazily; ERRORS_LOG constant below still points here.
const ERRORS_LOG = path.join(DATA_DIR, 'errors.log');

// ========================
// Helpers
// ========================
const sortBy = (key) => (a, b) => String(a[key] || '').localeCompare(String(b[key] || ''));
const newestFirst = (key) => (a, b) => new Date(b[key]) - new Date(a[key]);

// ========================
// BILLS (MongoDB collection: bills)
// ========================
app.get('/api/bills', async (req, res) => {
  const bills = await db.listAll('bills');
  bills.sort(newestFirst('invoiceDate'));
  res.json(bills);
});

app.post('/api/bills', async (req, res) => {
  const bill = req.body;
  if (!bill || !bill.id) return res.status(400).json({ error: 'Bill must have an id' });
  // The invoice-number field is free text on the client: a typo must not silently
  // overwrite a saved bill. Edits / auto-fire pass ?overwrite=1.
  const overwrite = req.query.overwrite === '1' || req.query.overwrite === 'true';
  if (overwrite) await db.upsert('bills', bill);
  else if (!(await db.insertNew('bills', bill))) {
    return res.status(409).json({
      error: 'A bill with this invoice number already exists',
      invoiceNumber: bill.id,
    });
  }
  res.json({ success: true });
});

// Is another bill using this bill as a client-credit source?
async function findCreditDependents(billId) {
  const match = { $elemMatch: { mode: 'credit-applied', creditSourceBillIds: billId } };
  const docs = await db.col('bills')
    .find({ _id: { $ne: String(billId) }, $or: [{ payments: match }, { 'data.payments': match }] })
    .toArray();
  return docs.map((o) => ({
    id: o.id,
    invoiceNumber: o.invoiceNumber,
    amount: (o.payments || o.data?.payments || []).find((p) => p?.mode === 'credit-applied')?.amount,
  }));
}

app.delete('/api/bills/:id', async (req, res) => {
  const id = req.params.id;
  const bill = await db.getById('bills', id);
  if (!bill) return res.json({ success: true });

  const force = req.query.force === '1' || req.query.force === 'true';
  if (!force) {
    const dependents = await findCreditDependents(id);
    if (dependents.length > 0) {
      return res.status(409).json({
        error: 'client-credit-dependency',
        message: 'This bill was used as a client-credit source on another invoice. Deleting it would leave that invoice paid via credit that no longer has a real source.',
        dependents,
      });
    }
  }
  if (req.query.permanent === '1') {
    await db.remove('bills', id);
    return res.json({ success: true, permanent: true });
  }
  // Soft delete: moved to the `trash` collection, purged after 30 days.
  await db.col('trash').replaceOne({ _id: String(id) }, { ...bill, trashedAt: new Date() }, { upsert: true });
  await db.remove('bills', id);
  res.json({ success: true, trashed: true });
});

// ========================
// PROFILE
// ========================
const DEFAULT_PROFILE = {
  businessName: '', address: '', state: '', gstin: '', pan: '',
  email: '', phone: '', bankName: '', accountNumber: '', ifsc: '',
  logo: '', signature: '', upiId: '', googleClientId: '', googleDriveFolder: 'GST Billing Invoices',
};
app.get('/api/profile', async (req, res) => res.json(await db.getDoc('profile', DEFAULT_PROFILE)));
app.post('/api/profile', async (req, res) => {
  await db.setDoc('profile', req.body);
  res.json({ success: true });
});

// ========================
// Simple collections: clients, products, expenses, recurring, receipts, purchases, profiles
// ========================
function crud(route, collection, idPrefix, sorter) {
  app.get(`/api/${route}`, async (req, res) => {
    const items = await db.listAll(collection);
    items.sort(sorter);
    res.json(items);
  });
  app.post(`/api/${route}`, async (req, res) => {
    const item = req.body;
    if (!item.id) item.id = idPrefix + Date.now();
    await db.upsert(collection, item);
    res.json({ success: true, id: item.id });
  });
  app.delete(`/api/${route}/:id`, async (req, res) => {
    await db.remove(collection, req.params.id);
    res.json({ success: true });
  });
}
crud('clients', 'clients', 'cli_', sortBy('name'));
crud('products', 'products', 'prod_', sortBy('name'));
crud('expenses', 'expenses', 'exp_', newestFirst('date'));
crud('recurring', 'recurring', 'rec_', sortBy('clientName'));
crud('receipts', 'receipts', 'rcp_', newestFirst('date'));
crud('purchases', 'purchases', 'pur_', newestFirst('date'));
crud('profiles', 'profiles', 'biz_', sortBy('businessName'));

// ========================
// TERMS TEMPLATES (seeded with a default on first read)
// ========================
const DEFAULT_TERMS = '1. Payment is due within 15 days of invoice date unless otherwise agreed in writing.\n2. Interest @ 18% p.a. will be charged on overdue payments beyond the due date.\n3. The scope of work is limited to what is explicitly mentioned in the project proposal/agreement. Any additional requirements will be quoted and billed separately.\n4. All intellectual property and source code will be transferred to the client only upon receipt of full payment.\n5. We shall not be liable for any delays caused by incomplete or late submission of content, credentials, or approvals from the client\'s end.\n6. Any change requests after project approval may attract additional charges and revised timelines.\n7. This invoice is subject to the jurisdiction of courts at the service provider\'s registered location.\n8. E. & O.E.';

app.get('/api/templates', async (req, res) => {
  let templates = await db.listAll('templates');
  if (templates.length === 0) {
    const defaultTpl = { id: 'default', name: 'Standard Terms', content: DEFAULT_TERMS };
    await db.upsert('templates', defaultTpl);
    templates = [defaultTpl];
  }
  templates.sort(sortBy('name'));
  res.json(templates);
});
app.post('/api/templates', async (req, res) => {
  const tpl = req.body;
  if (!tpl.id) tpl.id = 'tpl_' + Date.now();
  await db.upsert('templates', tpl);
  res.json({ success: true, id: tpl.id });
});
app.delete('/api/templates/:id', async (req, res) => {
  await db.remove('templates', req.params.id);
  res.json({ success: true });
});

// ========================
// META (counters, settings) - one document in the `settings` collection
// ========================
const LOCK_KEY = 'appLock';
const withoutLock = (meta) => { const { [LOCK_KEY]: _lock, ...rest } = meta || {}; return rest; };
const withLock = (meta, lock) => (lock ? { ...withoutLock(meta), [LOCK_KEY]: lock } : withoutLock(meta));

app.get('/api/meta/:key', async (req, res) => {
  if (req.params.key === LOCK_KEY) return errRes(res, 403, 'forbidden');
  const meta = await db.getMeta();
  res.json({ value: meta[req.params.key] ?? null });
});

app.post('/api/meta/:key', async (req, res) => {
  if (req.params.key === LOCK_KEY) return errRes(res, 403, 'forbidden');
  if (!req.body || !('value' in req.body)) return errRes(res, 400, 'bad-request');
  await db.updateMeta((meta) => { meta[req.params.key] = req.body.value; });
  res.json({ success: true });
});

// Atomic increment for invoice-number counters (db.updateMeta runs one at a time).
app.post('/api/meta/:key/increment', async (req, res) => {
  if (req.params.key === LOCK_KEY) return errRes(res, 403, 'forbidden');
  const next = await db.updateMeta((meta) => {
    const n = nextCounterValue(meta[req.params.key], req.body?.start);
    meta[req.params.key] = n;
    return n;
  });
  res.json({ value: next });
});

// ========================
// BROWSER SETTINGS COPY (LOCAL_PREFS_ROUTE is declared near the top of this file)
// ========================
app.get(LOCAL_PREFS_ROUTE, async (req, res) => {
  res.json({ value: await db.getDoc('localPrefs', {}) });
});
// { set: { key: string }, remove: [key] } - merged, never replaced wholesale.
app.post(LOCAL_PREFS_ROUTE, express.json({ limit: '25mb' }), async (req, res) => {
  const { set = {}, remove = [] } = req.body || {};
  if (!set || typeof set !== 'object' || Array.isArray(set) || !Array.isArray(remove)) return errRes(res, 400, 'bad-request');
  const prefs = await db.getDoc('localPrefs', {});
  for (const [k, v] of Object.entries(set)) if (typeof v === 'string') prefs[k] = v;
  for (const k of remove) delete prefs[String(k)];
  await db.setDoc('localPrefs', prefs);
  return res.json({ success: true });
});

// ========================
// PIN LOCK
// ========================
// Optional 6 or 8 digit PIN asked when the app opens. It is a screen lock, not
// encryption. Only a salted scrypt hash is stored. Forgotten PIN: put a file named
// RESET-PIN (or RESET-PIN.txt) in the app folder; the next check removes the PIN.
const PIN_RE = /^(\d{6}|\d{8})$/;
const RESET_PIN_FILES = [path.join(__dirname, '..'), __dirname]
  .flatMap((dir) => ['RESET-PIN', 'RESET-PIN.txt'].map((n) => path.join(dir, n)));
const pinHash = (pin, salt) => crypto.scryptSync(String(pin), salt, 32).toString('hex');
const pinMatches = (lock, pin) => {
  if (!lock?.salt || !lock?.hash || !PIN_RE.test(String(pin ?? ''))) return false;
  const a = Buffer.from(pinHash(pin, lock.salt), 'hex');
  const b = Buffer.from(lock.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
// Five wrong PINs in a row -> wait 30 seconds before the next try.
const pinTries = { wrong: 0, until: 0 };
const currentLock = async () => {
  const meta = await db.getMeta();
  const reset = RESET_PIN_FILES.filter((f) => fs.existsSync(f));
  if (reset.length) {
    if (meta[LOCK_KEY]) await db.updateMeta((m) => { delete m[LOCK_KEY]; });
    for (const f of reset) { try { fs.unlinkSync(f); } catch { /* removed already */ } }
    console.log('[lock] RESET-PIN file found: PIN lock removed');
    return null;
  }
  return meta[LOCK_KEY] || null;
};
const checkPin = (res, lock, pin) => {
  const wait = Math.ceil((pinTries.until - Date.now()) / 1000);
  if (wait > 0) { res.status(429).json({ ok: false, wait }); return false; }
  if (pinMatches(lock, pin)) { pinTries.wrong = 0; return true; }
  pinTries.wrong += 1;
  if (pinTries.wrong >= 5) { pinTries.wrong = 0; pinTries.until = Date.now() + 30000; }
  res.status(401).json({ ok: false, error: 'wrong-pin' });
  return false;
};

app.get('/api/lock', async (req, res) => {
  const lock = await currentLock();
  res.json({ enabled: !!lock, length: lock?.length || 0 });
});

app.post('/api/lock/verify', async (req, res) => {
  const lock = await currentLock();
  if (!lock) return res.json({ ok: true });
  if (checkPin(res, lock, req.body?.pin)) res.json({ ok: true });
  return undefined;
});

// Turn on, change ({ pin }) or turn off ({ pin: null }). When a PIN is already
// set, the current one must come with it.
app.post('/api/lock/set', async (req, res) => {
  const { pin, currentPin } = req.body || {};
  if (pin !== null && !PIN_RE.test(String(pin ?? ''))) return errRes(res, 400, 'bad-request');
  const lock = await currentLock();
  if (lock && !checkPin(res, lock, currentPin)) return undefined;
  await db.updateMeta((meta) => {
    if (pin === null) delete meta[LOCK_KEY];
    else {
      const salt = crypto.randomBytes(16).toString('hex');
      meta[LOCK_KEY] = { salt, hash: pinHash(pin, salt), length: String(pin).length };
    }
  });
  return res.json({ ok: true, enabled: pin !== null });
});

// ========================
// Number series follow a renamed business
// ========================
app.post('/api/number-series/rename', async (req, res) => {
  const { from, to } = req.body || {};
  if (!from || !to || typeof from !== 'string' || typeof to !== 'string' || from === to) return errRes(res, 400, 'bad-request');
  const moved = await db.updateMeta((meta) => {
    const series = meta.invoiceNumberSeries || {};
    if (!series[from] || series[to]) return false;
    series[to] = series[from];
    delete series[from];
    meta.invoiceNumberSeries = series;
    for (const key of Object.keys(meta)) {
      if (key.startsWith('counter_') && key.endsWith(`@${from}`)) {
        const target = key.slice(0, -from.length) + to;
        meta[target] = Math.max(Number(meta[target]) || 0, Number(meta[key]) || 0);
        delete meta[key];
      }
    }
    return true;
  });
  return res.json({ moved });
});

// ========================
// EXPORT / IMPORT
// ========================
app.get('/api/export', async (req, res) => {
  const [bills, profile, clients, termsTemplates, products, expenses, recurring, receipts, profiles, purchases, meta] =
    await Promise.all([
      db.listAll('bills'), db.getDoc('profile', DEFAULT_PROFILE), db.listAll('clients'),
      db.listAll('templates'), db.listAll('products'), db.listAll('expenses'),
      db.listAll('recurring'), db.listAll('receipts'), db.listAll('profiles'),
      db.listAll('purchases'), db.getMeta(),
    ]);
  res.json({
    bills, profile, clients, termsTemplates, products, expenses, recurring, receipts, profiles, purchases,
    // never the PIN hash: a backup file can travel (email, Drive)
    meta: withoutLock(meta),
    exportedAt: new Date().toISOString(),
  });
});

app.post('/api/import', async (req, res) => {
  const data = req.body || {};
  const overwrite = req.query.overwrite === '1' || req.query.overwrite === 'true';
  const counts = {};
  const groups = [
    ['bills', 'bills', 'bill'], ['clients', 'clients', 'client'],
    ['termsTemplates', 'templates', 'template'], ['products', 'products', 'product'],
    ['expenses', 'expenses', 'expense'], ['recurring', 'recurring', 'recurring'],
    ['receipts', 'receipts', 'receipt'], ['profiles', 'profiles', 'profile'],
    ['purchases', 'purchases', 'purchase'],
  ];
  for (const [key, coll, label] of groups) {
    const { count, skipped } = await db.upsertMany(coll, data[key], overwrite);
    counts[`${label}Count`] = count;
    counts[`${label}Skipped`] = skipped;
  }

  // Profile is a singleton; overwrite-gated the same way.
  if (data.profile && (overwrite || !(await db.getDoc('profile')))) {
    await db.setDoc('profile', data.profile);
  }

  if (data.meta) {
    await db.updateMeta((meta) => {
      if (overwrite || Object.keys(meta).length === 0) {
        // The PIN on this install stays as it is: a backup never sets, removes or restores a PIN.
        const lock = meta[LOCK_KEY];
        for (const k of Object.keys(meta)) delete meta[k];
        Object.assign(meta, withLock(withoutLock(data.meta), lock));
      } else {
        // A merge keeps what is here and adds the backup's own number series and the
        // higher of each counter, so no number is reused.
        const series = { ...(data.meta.invoiceNumberSeries || {}), ...(meta.invoiceNumberSeries || {}) };
        if (Object.keys(series).length) meta.invoiceNumberSeries = series;
        for (const [k, v] of Object.entries(data.meta)) {
          if (k.startsWith('counter_') && Number(v) > (Number(meta[k]) || 0)) meta[k] = Number(v);
        }
      }
    });
  }

  // Reconcile the counters with the highest number on any bill, so the next
  // reservation never collides with an imported invoice.
  try {
    const bills = await db.listAll('bills');
    await db.updateMeta((meta) => {
      const maxByPrefix = {};
      const maxByKey = {};
      for (const bill of bills) {
        const num = String(bill?.invoiceNumber || bill?.id || '');
        const m = num.match(/^([A-Z]+)[\W_].*?(\d+)\s*$/i);
        if (!m) continue;
        const prefix = m[1].toUpperCase();
        const suffix = parseInt(m[2], 10);
        if (!Number.isFinite(suffix)) continue;
        if (!maxByPrefix[prefix] || suffix > maxByPrefix[prefix]) maxByPrefix[prefix] = suffix;
        const typePrefix = INVOICE_TYPES[bill.invoiceType || bill.data?.invoiceType || 'tax-invoice']?.prefix;
        if (typePrefix) {
          const biz = businessKeyOf(bill.data?.profile || { gstin: bill.ownerGstin, businessName: bill.ownerName });
          const series = numberSeriesFor(meta.invoiceNumberSettings, meta.invoiceNumberSeries, biz);
          const head = formatDocNumber({ settings: { ...series, format: 'sequential', showFinYear: false }, typePrefix, next: 0 })
            .replace(/0+$/, '');
          if (num.toUpperCase().startsWith(head.toUpperCase())) {
            const key = counterKeyFor(typePrefix, series, biz);
            if (!maxByKey[key] || suffix > maxByKey[key]) maxByKey[key] = suffix;
          }
        }
      }
      const wanted = { ...Object.fromEntries(Object.entries(maxByPrefix).map(([p, n]) => [`counter_${p}`, n])), ...maxByKey };
      for (const [key, maxNum] of Object.entries(wanted)) {
        if (maxNum > (Number(meta[key]) || 0)) meta[key] = maxNum;
      }
    });
  } catch (err) {
    console.error('Post-import counter reconciliation failed:', err);
  }

  res.json({ ...counts, hasProfile: !!data.profile });
});

// ========================
// PDFs -> Cloudinary
// ========================
// Saved as Cloudinary "raw" + "authenticated" files under
// gst-invoices/<client>/<month>/<file>.pdf (see cloud.js). Open them with the
// signed `url` returned below; the folder layout matches the old "Saved Invoices".
app.post('/api/save-pdf', express.raw({ type: 'application/pdf', limit: '20mb' }), async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) return errRes(res, 400, 'bad-request');
  const client = safePathSegment(req.query.client, 'General');
  const month = safePathSegment(req.query.month, new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }));
  let name = safePathSegment(req.query.name || `invoice-${Date.now()}.pdf`, `invoice-${Date.now()}.pdf`);
  if (!name.toLowerCase().endsWith('.pdf')) name += '.pdf';

  const r = await cloud.uploadPdf(cloud.pdfId(cloud.BASE, client, month, name), req.body);
  // A PDF saved now replaces any original kept for Undo of a CANCELLED stamp.
  await cloud.destroy(cloud.pdfId(cloud.ORIG, client, month, name)).catch(() => {});
  res.json({ saved: true, relPath: r.public_id, url: cloud.signedUrl(r.public_id) });
});

async function stampCancelled(bytes) {
  // Loaded here, not at start-up: if pdf-lib were ever missing, only this stamp fails.
  const { PDFDocument, StandardFonts, rgb, degrees } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const text = 'CANCELLED';
  const angle = 30;
  const rad = (angle * Math.PI) / 180;
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const size = Math.min(width, height) / 6.5;
    const w = font.widthOfTextAtSize(text, size);
    // Start point that puts the middle of the rotated word at the page centre.
    const x = width / 2 - (w / 2) * Math.cos(rad) + (size / 3) * Math.sin(rad);
    const y = height / 2 - (w / 2) * Math.sin(rad) - (size / 3) * Math.cos(rad);
    page.drawText(text, { x, y, size, font, color: rgb(0.86, 0.15, 0.15), opacity: 0.28, rotate: degrees(angle) });
  }
  return doc.save();
}

// { fileName, clientName, cancelled } -> { updated: n, failed: n }
app.post('/api/saved-pdf/cancel-mark', express.json(), async (req, res) => {
  const { fileName, clientName, cancelled } = req.body || {};
  if (!fileName || typeof cancelled !== 'boolean') return errRes(res, 400, 'bad-request');
  let updated = 0;
  let failed = 0;
  const ids = await cloud.findPdfs(cloud.BASE, safePathSegment(clientName, 'General'), safePathSegment(fileName, 'Untitled.pdf'));
  for (const id of ids) {
    const originalId = id.replace(`${cloud.BASE}/`, `${cloud.ORIG}/`);
    // One copy that fails never stops the rest.
    try {
      if (cancelled) {
        // Always stamp from the original, so cancelling twice never stamps twice.
        if (!(await cloud.exists(originalId))) await cloud.uploadPdf(originalId, await cloud.downloadPdf(id));
        const stamped = await stampCancelled(await cloud.downloadPdf(originalId));
        await cloud.uploadPdf(id, Buffer.from(stamped));
        updated++;
      } else if (await cloud.exists(originalId)) {
        await cloud.uploadPdf(id, await cloud.downloadPdf(originalId));
        await cloud.destroy(originalId);
        updated++;
      }
    } catch (err) {
      failed++;
      console.warn('[pdf] CANCELLED stamp/undo failed:', err.message);
    }
  }
  res.json({ updated, failed });
});

// Move a saved PDF to the Cloudinary trash folder (gst-invoices-trash/...)
app.post('/api/trash-pdf', express.json(), async (req, res) => {
  const { fileName, clientName } = req.body || {};
  if (!fileName) return errRes(res, 400, 'bad-request');
  const [id] = await cloud.findPdfs(cloud.BASE, safePathSegment(clientName, 'General'), safePathSegment(fileName, 'Untitled.pdf'));
  if (!id) return res.json({ trashed: false });
  await cloud.movePdf(id, id.replace(`${cloud.BASE}/`, `${cloud.TRASH}/`));
  return res.json({ trashed: true });
});

// ========================
// Version check
// ========================
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));

app.get('/api/version', (req, res) => {
  res.json({ current: pkg.version });
});

// Naive semver compare — returns +1 if a > b, -1 if a < b, 0 if equal.
// "1.4.10" > "1.4.2" correctly (numeric parts), unlike a string compare.
function compareSemver(a, b) {
  const pa = String(a || '0').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

// v1.10.81 - "What's new" on the Support & About page: the CHANGELOG.md that
// ships in every ZIP next to this file, so it works offline. The page parses
// it (src/utils/changelog.js) and shows it as text, never as HTML.
app.get('/api/changelog', (req, res) => {
  fs.readFile(path.join(__dirname, 'CHANGELOG.md'), 'utf8', (err, text) => {
    if (err) return res.json({ text: '' });
    res.json({ text: text.slice(0, 400000) });
  });
});

app.get('/api/check-update', async (req, res) => {
  try {
    // Two parallel fetches: package.json (definitive version source) and the
    // GitHub Releases API (for release notes). Both have a 4s timeout so a
    // flaky network can't lock the UI.
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const [pkgRes, relRes] = await Promise.all([
      fetch('https://raw.githubusercontent.com/IamRamgarhia/Free-GST-Billing-Software/main/package.json', { signal: ctrl.signal }).catch(() => null),
      fetch('https://api.github.com/repos/IamRamgarhia/Free-GST-Billing-Software/releases/latest', {
        signal: ctrl.signal,
        headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'FreeGSTBill-update-check' },
      }).catch(() => null),
    ]);
    clearTimeout(t);

    let releaseNotes = null;
    let releaseUrl = null;
    let releasePublishedAt = null;
    let releaseTag = null;
    if (relRes && relRes.ok) {
      const rel = await relRes.json();
      releaseNotes = rel.body || null;
      releaseUrl = rel.html_url || null;
      releasePublishedAt = rel.published_at || null;
      releaseTag = rel.tag_name || null;
    }

    // #105: the updater installs the latest RELEASE, so its tag is the version
    // on offer. main's package.json can be ahead of it (merged, not released
    // yet) and then offered an update that re-installed the same version.
    // package.json is only the fallback when the Releases API can't be read.
    let latest = /^v?\d+\.\d+\.\d+$/.test(releaseTag || '') ? releaseTag.replace(/^v/, '') : null;
    if (!latest) {
      if (!pkgRes?.ok) throw new Error('GitHub fetch failed');
      latest = (await pkgRes.json()).version;
    }
    const updateAvailable = compareSemver(latest, pkg.version) > 0;

    res.json({
      current: pkg.version,
      latest,
      updateAvailable,
      releaseNotes,
      releaseUrl,
      releasePublishedAt,
      releaseTag,
    });
  } catch {
    res.json({ current: pkg.version, latest: null, updateAvailable: false, error: 'Could not check for updates' });
  }
});

// ============================================================
// v1.10.44 — In-app Control Panel API
// Powers /control-panel in the app. Each endpoint shells out to
// a platform-appropriate script under `_system-scripts/` — the copy inside
// `_system/` in a release install, or `release-templates/_system-scripts/`
// when running from the source repo.
// ============================================================
import { spawn } from 'child_process';

const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

// Where the launcher scripts live. In a release-ZIP install the app
// is under `_system/` so `..` gets us to the launcher's script dir;
// in dev the same relative path lands us at `release-templates/_system-scripts/`
// which also holds them. If neither exists we degrade gracefully —
// the Control Panel just shows the buttons as disabled.
// v1.10.72 (#73) — the release ZIP has always FLATTENED the scripts into
// _system/, right next to this file (build-release-zip.mjs copies
// _system-scripts/* into _system/). None of the old candidates existed in a
// ZIP install, so every user since v1.10.44 got "Launcher scripts not
// detected", and Update / Backup / Restore / Move / Stop failed with
// "Script not found". A folder now only counts if it really holds the update
// script, so an unrelated folder with the right name can't be picked either.
const SCRIPT_SUFFIX = isWindows ? '-windows.ps1' : '-unix.sh';
const CONTROL_SCRIPT_CANDIDATES = [
  __dirname,                                                     // release ZIP: _system/
  path.join(__dirname, 'release-templates', '_system-scripts'), // source repo
  path.join(__dirname, '_system-scripts'),                       // older layouts
  path.join(__dirname, '..', '_system-scripts'),
];
const controlScriptDir = CONTROL_SCRIPT_CANDIDATES.find(
  p => fs.existsSync(path.join(p, `update${SCRIPT_SUFFIX}`)),
) || null;

function pickScript(name) {
  if (!controlScriptDir) return null;
  const p = path.join(controlScriptDir, name + SCRIPT_SUFFIX);
  return fs.existsSync(p) ? p : null;
}

// Which Control Panel actions have a script on this platform. Linux / macOS
// ship update + backup only, so Restore / Move / Stop are shown as not
// available there instead of failing when clicked.
const CONTROL_ACTIONS = ['update', 'backup', 'restore', 'move', 'stop'];
const controlActions = () => Object.fromEntries(CONTROL_ACTIONS.map(a => [a, !!pickScript(a)]));

function runControlScript(scriptPath) {
  return new Promise((resolve) => {
    if (!scriptPath) { resolve({ ok: false, error: 'Not available here: the script for this action is not in the app folder. Download the latest ZIP to get it.' }); return; }
    // v1.10.66 (#59) — update-unix.sh is plain POSIX sh, so it runs under `sh`
    // and therefore also where bash does not exist (Alpine / BusyBox NAS
    // images). The other Unix scripts use bash features and keep running under
    // bash, found on PATH as before — /usr/local/bin/bash on TrueNAS CORE,
    // /run/current-system/sw/bin/bash on NixOS.
    const unixShell = path.basename(scriptPath) === 'update-unix.sh' ? 'sh' : 'bash';
    const [cmd, args] = isWindows
      ? ['powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath]]
      : [unixShell, [scriptPath]];
    let out = '', err = '';
    try {
      const child = spawn(cmd, args, { detached: false, windowsHide: false });
      child.stdout?.on('data', d => { out += d.toString(); });
      child.stderr?.on('data', d => { err += d.toString(); });
      child.on('error', e => resolve({ ok: false, error: e.message }));
      child.on('exit', code => resolve({ ok: code === 0, exitCode: code, stdout: out.slice(-4000), stderr: err.slice(-2000) }));
    } catch (e) {
      resolve({ ok: false, error: e.message });
    }
  });
}

app.get('/api/control-panel/status', (req, res) => {
  const dataSize = (() => {
    try {
      let total = 0;
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(p);
          else { try { total += fs.statSync(p).size; } catch { /* ignore */ } }
        }
      };
      if (fs.existsSync(DATA_DIR)) walk(DATA_DIR);
      return total;
    } catch { return 0; }
  })();
  // Port is bound in startServer() below; read it back from the socket
  // address at request time rather than relying on a module-level const
  // that doesn't exist. Falls back to the persisted preference for the
  // edge case where the request arrives before activeServer is set.
  let activePort = STARTING_PORT;
  try {
    const addr = activeServer && activeServer.address();
    if (addr && typeof addr === 'object' && addr.port) activePort = addr.port;
  } catch { /* keep fallback */ }
  res.json({
    platform: process.platform,
    node: process.version,
    controlScriptsAvailable: !!controlScriptDir,
    actions: controlActions(),
    dataFolder: DATA_DIR,
    dataSizeBytes: dataSize,
    port: activePort,
    launcherType: controlScriptDir ? (isWindows ? 'hta' : (isMac ? 'command' : 'sh')) : 'none',
  });
});

app.post('/api/control-panel/backup', async (req, res) => {
  const script = pickScript('backup');
  const result = await runControlScript(script);
  res.json(result);
});

app.post('/api/control-panel/open-data-folder', (req, res) => {
  try {
    if (isWindows) spawn('explorer.exe', [DATA_DIR], { detached: true }).unref();
    else if (isMac) spawn('open', [DATA_DIR], { detached: true }).unref();
    else spawn('xdg-open', [DATA_DIR], { detached: true }).unref();
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post('/api/control-panel/open-backups-folder', (req, res) => {
  const backupsHome = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Documents', 'FreeGSTBill Backups');
  try {
    if (!fs.existsSync(backupsHome)) fs.mkdirSync(backupsHome, { recursive: true });
    if (isWindows) spawn('explorer.exe', [backupsHome], { detached: true }).unref();
    else if (isMac) spawn('open', [backupsHome], { detached: true }).unref();
    else spawn('xdg-open', [backupsHome], { detached: true }).unref();
    res.json({ ok: true, path: backupsHome });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post('/api/control-panel/launch-script', async (req, res) => {
  // Whitelisted script actions the Control Panel exposes.
  const allowed = new Set(['update', 'restore', 'move', 'stop']);
  const action = String(req.body?.action || '');
  if (!allowed.has(action)) { res.status(400).json({ ok: false, error: 'Unknown action' }); return; }
  const script = pickScript(action);
  const result = await runControlScript(script);
  res.json(result);
});

// ========================
// Serve production build
// ========================
// We register BOTH the static middleware and the SPA catch-all unconditionally.
// The static middleware silently no-ops when dist/ doesn't exist; the catch-all
// then checks per-request and serves either index.html (build ready) or the
// friendly "still building" page (build not ready). This means the server can
// start before `vite build` finishes — common in StackBlitz, Codespaces, or
// when a user accidentally runs `node server.js` directly — and seamlessly
// flips to serving the app the moment dist/ appears.
const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');
app.use(express.static(distPath, { fallthrough: true })); // fallthrough = ok if dist doesn't exist

// ============================================================
// Backups: the data now lives in MongoDB, so backups are MongoDB's job
// (Atlas backup / mongodump) plus Settings -> Export (JSON). These stubs keep the
// old Settings screen from showing errors. They MUST stay before the SPA catch-all.
// ============================================================
app.get('/api/backups', (req, res) => res.json([]));
app.post('/api/backups/now', (req, res) => res.json({ success: true }));
app.delete('/api/backups/:date', (req, res) => errRes(res, 404, 'not-found'));
app.post('/api/backups/:date/restore', (req, res) =>
  res.status(410).json({ error: 'Restore is now done with Import (JSON) or a MongoDB backup', code: 'gone' }));
app.get('/api/backup-folder', (req, res) => res.json({ path: '', copiesIn: null, error: '' }));
app.post('/api/backup-folder', (req, res) => res.json({ ok: true, path: '' }));

// ---- Trash bin (soft delete for invoices: MongoDB collection `trash`) ----
app.get('/api/trash', async (req, res) => {
  const docs = await db.listAll('trash');
  res.json(docs.map(({ trashedAt, ...bill }) => ({ ...bill, _trashedAt: new Date(trashedAt).toISOString() })));
});

app.post('/api/trash/:id/restore', async (req, res) => {
  const doc = await db.col('trash').findOne({ _id: String(req.params.id) });
  if (!doc) return res.status(404).json({ error: 'Not in trash' });
  const { _id, trashedAt: _trashedAt, ...bill } = doc;
  // A new bill may have taken this number since: never replace it.
  if (!(await db.insertNew('bills', bill))) {
    return res.status(409).json({ error: 'An invoice with this number exists again. Rename or delete it first.' });
  }
  await db.remove('trash', _id);
  return res.json({ success: true });
});

app.delete('/api/trash/:id', async (req, res) => {
  await db.remove('trash', req.params.id);
  res.json({ success: true });
});

async function purgeOldTrash() {
  try {
    await db.col('trash').deleteMany({ trashedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } });
  } catch { /* ignore */ }
}
setTimeout(purgeOldTrash, 10000);
setInterval(purgeOldTrash, 24 * 60 * 60 * 1000);

// v1.10.0 — Health-check endpoint moved here (was registered AFTER the
// SPA catch-all → every GET /api/health returned "No such endpoint" →
// the UI's health-banner was permanently broken). Now registered
// before the catch-all so it actually serves.
app.get('/api/health', (req, res) => {
  let errorsTail = '';
  try {
    if (fs.existsSync(ERRORS_LOG)) {
      const stat = fs.statSync(ERRORS_LOG);
      // Read the last 4KB only so a runaway log file can't OOM the response.
      const fd = fs.openSync(ERRORS_LOG, 'r');
      const len = Math.min(stat.size, 4096);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, Math.max(0, stat.size - len));
      fs.closeSync(fd);
      errorsTail = buf.toString('utf-8');
    }
  } catch { /* ignore */ }
  res.json({
    ok: true,
    version: process.env.npm_package_version || 'unknown',
    uptimeSec: Math.round(process.uptime()),
    pid: process.pid,
    hasRecentErrors: !!errorsTail.trim(),
    errorsTail,
  });
});

app.get('{*path}', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'No such endpoint' });
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  // Build not ready yet — serve friendly waiting page (auto-refreshes every 3s).
  return servePlaceholder(req, res);
});

function servePlaceholder(req, res) {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'No such endpoint' });
    res.status(503).send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Free GST Billing Software — building…</title>
<meta http-equiv="refresh" content="3">
<style>
  body { font-family: -apple-system, Segoe UI, Inter, sans-serif; max-width: 560px;
         margin: 6rem auto; padding: 2rem; color: #1e293b; line-height: 1.55; }
  h1 { color: #1e40af; margin: 0 0 0.5rem; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
  .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #cbd5e1;
             border-top-color: #1e40af; border-radius: 50%; animation: spin 1s linear infinite;
             vertical-align: middle; margin-right: 6px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .muted { color: #64748b; font-size: 0.9em; }
  .box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.85rem 1rem; border-radius: 8px; margin-top: 1rem; }
</style></head>
<body>
  <h1>Free GST Billing Software</h1>
  <p><span class="spinner"></span> The app is still building. This page refreshes every 3 seconds.</p>
  <div class="box">
    <p style="margin:0 0 0.5rem"><strong>Local install?</strong></p>
    <p style="margin:0">If you started the server but never built the frontend, run:</p>
    <p style="margin:0.5rem 0 0"><code>npm run build</code></p>
    <p class="muted" style="margin:0.5rem 0 0">…then reload this page.</p>
  </div>
  <div class="box">
    <p style="margin:0 0 0.5rem"><strong>StackBlitz / Codespaces?</strong></p>
    <p style="margin:0">First-time build takes ~30 seconds inside browser sandboxes. Sit tight.</p>
  </div>
  <p class="muted" style="margin-top:1.5rem">Server is running on port ${req.socket.localPort} · API health: <a href="/api/version">/api/version</a></p>
</body></html>`);
}

// v1.10.0 — Global error handler. Registered LAST so all preceding
// route handlers can forward errors to it. Express 5 auto-catches
// synchronous throws and async rejections from route handlers, so we
// no longer need try/catch around every writeJSON call. Server-side
// logs full detail; client sees a generic JSON error with a stable
// code — no leaked stack traces or absolute filesystem paths.
// Preserves upstream status codes from body-parser (413 payload too
// large, 400 malformed JSON) so clients can differentiate.
// 4-arg signature is required by Express
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = Number(err && (err.status || err.statusCode)) || 500;
  let code = 'server-error';
  if (status === 413) code = 'payload-too-large';
  else if (status === 400) code = 'bad-request';
  else if (status === 404) code = 'not-found';
  errRes(res, status, code, err);
});

// ============================================================
// Error log + graceful shutdown
// ============================================================
// ERRORS_LOG was declared once at the top of this file (v1.10.0)
// where errRes() needs it. See line ~145.

// v1.10.0 — log rotation. Previously `data/errors.log` grew unbounded;
// a tight failure loop (e.g. daily backup hitting a corrupted template)
// would fill the disk. Now we keep only the last ~200KB. Called
// opportunistically from logFatal — no separate timer.
const ERRORS_LOG_MAX = 200 * 1024;
function rotateErrorsIfLarge() {
  try {
    if (!fs.existsSync(ERRORS_LOG)) return;
    const stat = fs.statSync(ERRORS_LOG);
    if (stat.size <= ERRORS_LOG_MAX) return;
    // Read the tail we want to keep, then rewrite atomically.
    const fd = fs.openSync(ERRORS_LOG, 'r');
    const keep = Buffer.alloc(ERRORS_LOG_MAX);
    fs.readSync(fd, keep, 0, ERRORS_LOG_MAX, stat.size - ERRORS_LOG_MAX);
    fs.closeSync(fd);
    // Trim to next newline so we don't leave a half-line at the top.
    const s = keep.toString('utf-8');
    const nl = s.indexOf('\n');
    writeFileAtomic(ERRORS_LOG, (nl >= 0 ? s.slice(nl + 1) : s));
  } catch { /* ignore */ }
}

function logFatal(err, source = 'fatal') {
  try {
    rotateErrorsIfLarge();
    const ts = new Date().toISOString();
    const msg = err && err.stack ? err.stack : String(err);
    fs.appendFileSync(ERRORS_LOG, `[${ts}] [${source}] ${msg}\n`, 'utf-8');
  } catch { /* nothing we can do if even appending fails */ }
}

// Last-resort handlers — log the error but do NOT call process.exit so the
// running server keeps serving healthy requests. Per Node best-practice,
// uncaughtException leaves the process in an unknown state, so we write the
// log and let the OS / a wrapper script decide whether to restart.
process.on('uncaughtException', (err) => logFatal(err, 'uncaughtException'));
process.on('unhandledRejection', (err) => logFatal(err, 'unhandledRejection'));

// Note: /api/health used to live below the SPA catch-all here, so the
// catch-all was swallowing every request to it and returning "No such
// endpoint". Moved above the catch-all in v1.10.0. See earlier in file.

// Try ports starting from STARTING_PORT (persisted preference) until one is available.
// Bound to 127.0.0.1 explicitly so the server can NEVER be reached from the LAN —
// every byte stays on the user's machine, which the privacy promise depends on.
let activeServer = null;
function startServer(port) {
  const server = app.listen(port, '127.0.0.1', () => {
    activeServer = server;
    // Persist the chosen port — the .bat launcher reads this for the browser URL.
    // Writing on EVERY successful boot means: if our preferred 47371 was busy and
    // we landed on 47372 instead, next launch tries 47372 first (cuts collision
    // scans in half on repeated reboots of whatever was holding 47371).
    try { fs.writeFileSync(PORT_FILE, String(port), 'utf-8'); } catch { /* ignore */ }
    console.log(`\n  Free GST Billing Software running at http://localhost:${port}`);
    console.log(`  Data stored in: ${DATA_DIR}\n`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < STARTING_PORT + MAX_PORT_SCAN) {
      console.log(`  Port ${port} is busy, trying ${port + 1}...`);
      startServer(port + 1);
    } else if (err.code === 'EADDRINUSE') {
      // We've exhausted the scan range. Tell the OS to pick anything free — at
      // this point the user has 50+ apps fighting for the 47371-47421 range,
      // which we treat as "do whatever works" rather than failing to start.
      console.warn(`  Scanned ${MAX_PORT_SCAN} ports from ${STARTING_PORT} — letting OS assign a free one.`);
      startServer(0);
    } else {
      console.error(`  Failed to start server: ${err.message}`);
      // Persist the failure so the user has a breadcrumb when the silent
      // launcher exits without any visible window.
      logFatal(err, 'startup');
      process.exit(1);
    }
  });
}

// Graceful shutdown — the launcher's Stop Server runs taskkill /f, which can
// interrupt a sync write mid-flight. SIGINT (Ctrl+C in foreground) and SIGTERM
// (clean kill) get a 3-second window to flush.
function gracefulShutdown(signal) {
  console.log(`\n  Received ${signal}, closing connections...`);
  if (!activeServer) { process.exit(0); return; }
  const force = setTimeout(() => {
    console.warn('  Force-exiting after 3s grace period');
    process.exit(1);
  }, 3000);
  force.unref();
  activeServer.close(() => {
    clearTimeout(force);
    console.log('  Server closed cleanly.');
    process.exit(0);
  });
}
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// =====================================================
// Recurring invoices — auto-fire on boot + daily interval
// =====================================================
// For every recurring template with `nextDate <= today` and `active === true`,
// generate a new invoice (with a fresh sequential number for the matching
// type prefix and today's date) and advance the template's `nextDate` by its
// frequency. Honours `endMode` so weekly-for-12-weeks contracts stop themselves.
//
// Why server-side (and not in the React app): if the user opens the app on
// the 5th but the template was due on the 1st, the missed-cycle invoice still
// fires here. The frontend would only see it if the user happened to open the
// app between firings — fragile.
//
// Why no Windows scheduled task (yet): the server starts on every Windows
// login via the Startup-folder shortcut, so booting your PC = a check.
// Long-uptime users get a daily `setInterval` below as a backstop.
// Calendar arithmetic on YYYY-MM-DD, done in UTC so the machine's time zone
// can never move the date. (It used to parse the date as UTC, step it in
// local time and print it as UTC again: a day off west of Greenwich.)
const isoDay = (d) => d.toISOString().split('T')[0];
function parseIsoDay(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || ''));
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
}
function addDays(dateStr, days) {
  const d = parseIsoDay(dateStr);
  if (!d) return '';
  d.setUTCDate(d.getUTCDate() + days);
  return isoDay(d);
}
// Monthly / quarterly / yearly steps keep the day of month the schedule
// started on (`anchorDay`), clamped to short months: 31 Jan -> 28 Feb ->
// 31 Mar. setMonth() overflowed instead (31 Jan + 1 month = 3 Mar, so
// February was skipped and every later date drifted).
function advanceDate(dateStr, frequency, interval, anchorDay) {
  const d = parseIsoDay(dateStr);
  if (!d) return dateStr;
  const n = Math.max(1, parseInt(interval, 10) || 1);
  if (frequency === 'weekly') {
    d.setUTCDate(d.getUTCDate() + 7 * n);
    return isoDay(d);
  }
  const months = frequency === 'quarterly' ? 3 * n : frequency === 'yearly' ? 12 * n : n; // default: monthly
  const day = Math.min(31, Math.max(1, parseInt(anchorDay, 10) || d.getUTCDate()));
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return isoDay(target);
}

async function nextInvoiceNumber(prefix, invoiceType = 'tax-invoice', businessKey = '') {
  // The same rules as the app's getNextInvoiceNumber (src/utils.js): the business's
  // own series when it has one, else the shared one; atomic counter in meta;
  // brand-TYPE prefixes; India's FY label.
  return db.updateMeta((meta) => {
    const series = numberSeriesFor(meta.invoiceNumberSettings, meta.invoiceNumberSeries, businessKey);
    const key = counterKeyFor(prefix, series, businessKey);
    const next = nextCounterValue(meta[key], startFor(invoiceType, series));
    meta[key] = next;
    return formatDocNumber({ settings: series, typePrefix: prefix, next, fyLabel: getFinancialYearLabel() });
  });
}

// v1.10.6 — audit L19: made async and yields between templates via
// setImmediate. Prior code was one uninterrupted sync loop over every
// recurring template with sync FS writes; N templates × K items
// blocked the event loop → HTTP handlers froze until it finished.
// Now: single-template body is unchanged, but each iteration awaits
// setImmediate() so pending fetches / API calls get a slot.
// Today as YYYY-MM-DD in the computer's own time zone. toISOString() is UTC,
// which in India is still "yesterday" until 05:30.
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// A template made on the Recurring screen before it stored `active` has no
// flag at all; the screen shows those as Active, so treat them as active.
const templateIsActive = (tpl) => tpl.active !== false;
const templateHasEnded = (tpl, today) =>
  (tpl.endMode === 'onDate' && tpl.endDate && today > tpl.endDate)
  || (tpl.endMode === 'afterN' && tpl.maxOccurrences && (tpl.occurrencesCreated || 0) >= tpl.maxOccurrences);

// Makes ONE invoice from a template and moves the template on. Used by the
// daily auto-fire and by the app's "Generate Now", so both produce the same
// invoice (Generate Now used to do its own simplified maths in the browser:
// no CGST/SGST/IGST split, no end conditions, interval ignored).
async function generateFromTemplate(tpl, today) {
      // The business this template bills for: the one it was assigned to
      // (ownerGstin), else its saved profile id / name, else the active one.
      const profiles = await db.listAll('profiles');
      let profile = profiles.find(p => p.gstin && tpl.ownerGstin && p.gstin === tpl.ownerGstin)
                 || profiles.find(p => p.id && tpl.profileId && p.id === tpl.profileId)
                 || profiles.find(p => p.businessName && p.businessName === (tpl.profileBusinessName || tpl.ownerName))
                 || (await db.getDoc('profile', {}));

      const prefix = (tpl.invoiceType === 'proforma' ? 'EST'
                   : tpl.invoiceType === 'quotation' ? 'QUO'
                   : tpl.invoiceType === 'credit-note' ? 'CN'
                   : tpl.invoiceType === 'bill-of-supply' ? 'BOS'
                   : tpl.invoiceType === 'composition' ? 'COMP'
                   : tpl.invoiceType === 'delivery-challan' ? 'DC'
                   : 'INV');
      // Never overwrite an existing invoice: if the counter lags behind the
      // bills on disk (restored backup, hand-typed numbers), take the next one.
      const bizKey = businessKeyOf(profile);
      let invoiceNumber = await nextInvoiceNumber(prefix, tpl.invoiceType, bizKey);
      for (let i = 0; i < 50 && await db.exists('bills', invoiceNumber); i++) {
        invoiceNumber = await nextInvoiceNumber(prefix, tpl.invoiceType, bizKey);
      }
      const invoiceDate = today;

      // v1.10.31 — Data-F3.1: use shared computeInvoiceTotals so every math
      // fix (UTGST, cess, RCM, TDS/TCS ₹50L threshold, discount modes,
      // tax-inclusive, invoice-level discount, round-off) applies here too.
      // Prior inline math didn't recognise ANY of those and silently produced
      // wrong tax buckets for recurring bills. All the v1.10.1 audit fixes
      // were being reintroduced here.
      // v1.10.66 (#61) — the client's country decides whether the supply is
      // an export (IGST); place of supply and SEZ decide the split as on the
      // invoice screen. templateTotals (src/utils.js) is shared with the
      // Recurring screen, so the amount it shows is the amount billed.
      // The client's sales so far this year, for the ₹50L TCS/TDS threshold.
      const ytd = clientYearToDate(await db.listAll('bills'), tpl.clientName, today);
      const totals = templateTotals(tpl, profile, { tcsCumulativeThisYear: ytd, tdsCumulativeThisYear: ytd });
      const totalAmount = totals.total;
      const taxTotal = totals.totalTaxAmount;
      // Due date: the same number of days after the invoice date as on the
      // invoice the template was made from (none when it had no due date).
      const dueDays = Number(tpl.dueDays);
      const dueDate = Number.isFinite(dueDays) && dueDays >= 0 && tpl.dueDays !== '' && tpl.dueDays !== null
        ? addDays(invoiceDate, dueDays) : '';

      const bill = {
        id: invoiceNumber,
        clientName: tpl.clientName,
        invoiceNumber,
        invoiceDate,
        invoiceType: tpl.invoiceType || 'tax-invoice',
        currency: (tpl.invoiceOptions && tpl.invoiceOptions.currency) || 'INR',
        totalAmount,
        totalTaxAmount: taxTotal,
        status: 'unpaid',
        paidAmount: 0,
        payments: [],
        generatedFrom: tpl.id,
        autoGenerated: true,
        autoGeneratedAt: new Date().toISOString(),
        data: {
          profile,
          client: {
            name: tpl.clientName, state: tpl.clientState, gstin: tpl.clientGstin,
            address: tpl.clientAddress, country: tpl.clientCountry, city: tpl.clientCity,
            pin: tpl.clientPin, email: tpl.clientEmail, phone: tpl.clientPhone,
            isSEZ: tpl.isSEZ,
          },
          // The place of supply the totals were worked out with: left blank,
          // GSTR-1 and the printed invoice fell back to the client's state.
          details: { invoiceNumber, invoiceDate, dueDate, placeOfSupply: tpl.placeOfSupply || '' },
          // Normalize item.name from legacy description field (v1.6.7-and-earlier
          // templates used `description` — auto-fired bills rendered blank rows).
          items: (tpl.items || []).map(i => ({
            ...i,
            name: i.name || i.description || '',
          })),
          totals,
          invoiceType: tpl.invoiceType || 'tax-invoice',
          customTerms: tpl.customTerms || '',
          customNotes: tpl.customNotes || '',
          extraSections: tpl.extraSections || [],
          invoiceOptions: tpl.invoiceOptions || {},
          taxInclusive: !!tpl.taxInclusive,
        },
      };

      await db.upsert('bills', bill);

      // Advance the template. The day of month it started on is remembered,
      // so a schedule on the 31st comes back to the 31st after February.
      const from = tpl.nextDate || today;
      if (!tpl.anchorDay && tpl.frequency !== 'weekly') tpl.anchorDay = Number(from.slice(8, 10)) || undefined;
      tpl.nextDate = advanceDate(from, tpl.frequency, tpl.interval, tpl.anchorDay);
      tpl.lastGenerated = today;
      tpl.occurrencesCreated = (tpl.occurrencesCreated || 0) + 1;
      await db.upsert('recurring', tpl);
      return invoiceNumber;
}

async function processDueRecurring() {
  const today = localToday();
  const templates = await db.listAll('recurring');
  let fired = 0;
  const yieldToLoop = () => new Promise(r => setImmediate(r));
  for (const tpl of templates) {
    await yieldToLoop();
    if (!tpl || !templateIsActive(tpl)) continue;
    if (!tpl.nextDate || tpl.nextDate > today) continue;
    if (templateHasEnded(tpl, today)) continue;
    try {
      await generateFromTemplate(tpl, today);
      fired += 1;
    } catch (err) {
      logFatal(err, 'recurring');
    }
  }
  if (fired > 0) {
    console.log(`  Auto-generated ${fired} recurring invoice${fired !== 1 ? 's' : ''}.`);
    // Surface the count so the frontend notification centre can pick it up.
    await db.updateMeta((meta) => {
      meta.lastRecurringAutoFire = { date: today, count: fired, at: new Date().toISOString() };
    });
  }
}

// "Generate Now" on the Recurring screen: one invoice from one template, now,
// even if it is paused or not yet due (the user asked for it), but not after
// the template has ended.
app.post('/api/recurring/:id/generate', async (req, res) => {
  try {
    const tpl = (await db.listAll('recurring')).find(t => t && t.id === req.params.id);
    if (!tpl) return res.status(404).json({ error: 'Recurring template not found' });
    const today = localToday();
    if (templateHasEnded(tpl, today)) {
      return res.status(409).json({ error: 'This template has reached its end date or number of invoices' });
    }
    const invoiceNumber = await generateFromTemplate(tpl, today);
    res.json({ success: true, invoiceNumber });
  } catch (err) {
    logFatal(err, 'recurring-generate');
    res.status(500).json({ error: err.message || 'Could not generate the invoice' });
  }
});

startServer(STARTING_PORT);
// Fire once after a short delay so the listener is up first; then once a day
// for users whose server stays up >24h.
// v1.10.6 — audit L19: async caller. Uncaught rejections logged via
// the top-level unhandledRejection handler installed above.
setTimeout(() => { processDueRecurring().catch(err => logFatal(err, 'recurring')); }, 3000);
// Hourly: a template only fires once its nextDate has come, so checking more
// often never makes extra invoices - it just stops a template due today from
// waiting until the same time tomorrow on a PC that stays on.
setInterval(() => { processDueRecurring().catch(err => logFatal(err, 'recurring')); }, 60 * 60 * 1000);
