import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is not set. Copy .env.example to .env and fill it in.');

const client = new MongoClient(uri);
await client.connect();
const database = client.db(process.env.MONGODB_DB || 'gst_billing');
console.log('  MongoDB connected');

export const col = (name) => database.collection(name);

// Every record's own `id` becomes Mongo's _id.
const toDoc = (e) => ({ ...e, _id: String(e.id) });
const fromDoc = (d) => { if (!d) return d; const { _id, ...rest } = d; return rest; };

await Promise.all([
  col('bills').createIndex({ invoiceDate: -1 }),
  col('bills').createIndex({ clientName: 1 }),
  col('trash').createIndex({ trashedAt: 1 }),
]);

export const listAll = async (name, filter = {}) =>
  (await col(name).find(filter).toArray()).map(fromDoc);

export const getById = async (name, id) => fromDoc(await col(name).findOne({ _id: String(id) }));

export const exists = async (name, id) =>
  (await col(name).countDocuments({ _id: String(id) }, { limit: 1 })) > 0;

export const upsert = async (name, entity) => {
  const { _id, ...doc } = toDoc(entity);
  await col(name).replaceOne({ _id }, doc, { upsert: true });
};

// false = an entity with this id already exists (duplicate)
export const insertNew = async (name, entity) => {
  try { await col(name).insertOne(toDoc(entity)); return true; }
  catch (e) { if (e.code === 11000) return false; throw e; }
};

export const remove = (name, id) => col(name).deleteOne({ _id: String(id) });

// Used by Import: with overwrite=false, existing ids are skipped.
export async function upsertMany(name, list, overwrite) {
  const valid = (list || []).filter((e) => e && e.id !== undefined && e.id !== null && e.id !== '');
  let count = 0;
  for (let i = 0; i < valid.length; i += 500) {
    const ops = valid.slice(i, i + 500).map((e) => {
      const { _id, ...doc } = toDoc(e);
      return overwrite
        ? { replaceOne: { filter: { _id }, replacement: doc, upsert: true } }
        : { updateOne: { filter: { _id }, update: { $setOnInsert: doc }, upsert: true } };
    });
    const r = await col(name).bulkWrite(ops, { ordered: false });
    count += overwrite ? r.matchedCount + r.upsertedCount : r.upsertedCount;
  }
  return { count, skipped: valid.length - count };
}

// Single documents: profile, meta, localPrefs
export const getDoc = async (key, fallback = null) => {
  const d = await col('settings').findOne({ _id: key });
  return d ? d.value : fallback;
};
export const setDoc = (key, value) => col('settings').replaceOne({ _id: key }, { value }, { upsert: true });

export const getMeta = async () => (await getDoc('meta', {})) || {};

// Read-modify-write on meta, one at a time, so invoice counters never collide.
let metaChain = Promise.resolve();
export function updateMeta(fn) {
  const run = metaChain.then(async () => {
    const meta = await getMeta();
    const result = await fn(meta);   // fn changes `meta` in place
    await setDoc('meta', meta);
    return result;
  });
  metaChain = run.catch(() => {});
  return run;
}
