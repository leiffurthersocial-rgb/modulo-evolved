/** Tiny promise wrapper over IndexedDB for world saves (large, binary). */
const DB = "modulo-evolved";
const STORE = "saves";

export interface SaveMeta {
  id: string;
  name: string;
  savedAt: number;
  day: number;
  scenario: string;
  animals: number;
  species: number;
  bytes: number;
}

interface SaveRecord {
  meta: SaveMeta;
  data: Uint8Array;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putSave(meta: SaveMeta, data: Uint8Array) {
  await tx("readwrite", (s) => s.put({ meta, data } satisfies SaveRecord, meta.id));
}

export async function getSave(id: string): Promise<SaveRecord | undefined> {
  return tx<SaveRecord | undefined>("readonly", (s) => s.get(id));
}

export async function deleteSave(id: string) {
  await tx("readwrite", (s) => s.delete(id));
}

export async function listSaves(): Promise<SaveMeta[]> {
  const all = await tx<SaveRecord[]>("readonly", (s) => s.getAll());
  return all.map((r) => r.meta).sort((a, b) => b.savedAt - a.savedAt);
}
