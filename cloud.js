import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const BASE = 'gst-invoices';
export const TRASH = 'gst-invoices-trash';
export const ORIG = 'gst-invoices-originals';   // original kept for Undo of a CANCELLED stamp

// 'authenticated' = nobody can open an invoice without a signed link (GST / financial data).
const OPTS = { resource_type: 'raw', type: 'authenticated' };

const clean = (s) => String(s).replace(/[&#%,+;=\s]+/g, '_');
export const pdfId = (root, client, month, name) => `${root}/${clean(client)}/${clean(month)}/${clean(name)}`;

export const uploadPdf = (publicId, buffer) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ ...OPTS, public_id: publicId, overwrite: true, invalidate: true },
        (err, r) => (err ? reject(err) : resolve(r)))
      .end(buffer);
  });

export const signedUrl = (publicId) => cloudinary.url(publicId, { ...OPTS, sign_url: true, secure: true });

export async function downloadPdf(publicId) {
  const r = await fetch(signedUrl(publicId));
  if (!r.ok) throw new Error(`Cloudinary download failed: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

export const destroy = (publicId) => cloudinary.uploader.destroy(publicId, { ...OPTS, invalidate: true });

export const movePdf = (from, to) =>
  cloudinary.uploader.rename(from, to, { ...OPTS, overwrite: true, invalidate: true });

export async function exists(publicId) {
  try { await cloudinary.api.resource(publicId, OPTS); return true; }
  catch (e) { if (e?.error?.http_code === 404) return false; throw e; }
}

// Finds <root>/<client>/<any month>/<fileName>
export async function findPdfs(root, client, fileName) {
  const prefix = `${root}/${clean(client)}/`;
  const suffix = `/${clean(fileName)}`;
  const found = [];
  let next;
  do {
    const r = await cloudinary.api.resources({ ...OPTS, prefix, max_results: 500, next_cursor: next });
    for (const x of r.resources) if (x.public_id.endsWith(suffix)) found.push(x.public_id);
    next = r.next_cursor;
  } while (next);
  return found;
}
