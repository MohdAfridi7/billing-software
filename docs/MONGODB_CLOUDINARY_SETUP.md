# MongoDB + Cloudinary setup

This build stores data in **MongoDB** (instead of `data/*.json`) and saves invoice PDFs in **Cloudinary** (instead of `Saved Invoices/`). The `/api/...` routes are unchanged, so the React app needs no changes.

## 1. Configure
```bash
npm install
cp .env.example .env      # then fill in the 5 values
npm run build
npm run server            # or: npm start
```
`.env` values: `MONGODB_URI`, `MONGODB_DB`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Never commit `.env`.

Console must print `MongoDB connected`.

## 2. Where things live now
| What | Where |
|---|---|
| bills, clients, products, expenses, purchases, receipts, recurring, templates, profiles | MongoDB collections with the same names (`_id` = the record's `id`) |
| deleted invoices (30 days) | collection `trash` |
| active profile, meta (counters, settings, PIN hash), browser-settings copy | collection `settings`, documents `profile`, `meta`, `localPrefs` |
| invoice PDFs | Cloudinary `raw` + `authenticated`: `gst-invoices/<client>/<month>/<file>.pdf` |
| PDF trash / CANCELLED originals | `gst-invoices-trash/...`, `gst-invoices-originals/...` |
| `data/port.txt`, `data/errors.log` | still on disk |

## 3. Moving your old data
In the OLD install: Settings -> Export (JSON). In this install: Settings -> Import. Old PDFs in `Saved Invoices/` must be uploaded to Cloudinary by hand (folder layout above) if you want them there.

## 4. Things to know
- Cloudinary blocks PDF delivery on new accounts by default: Settings -> Security -> enable "PDF and ZIP files delivery".
- Atlas: add your IP under Network Access. The free M0 tier has no automatic backups: use Settings -> Export regularly, or a paid tier.
- Daily file backups and "Backup folder" are gone (stubs remain so Settings does not error). Backups are MongoDB's job now.
- Do NOT use the Control Panel "Update" button: it overwrites `server.js` with the stock version.
- The server still binds to 127.0.0.1 and CORS only allows localhost, and the only protection is the screen-lock PIN. Before putting this online, add real authentication, change the CORS rule and bind address.
- Needs MongoDB 5.0+ (Atlas default).
