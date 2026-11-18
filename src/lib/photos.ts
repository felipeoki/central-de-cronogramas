import { useEffect, useState } from "react";

/**
 * Stage photos. The project data (localStorage) only keeps each photo's metadata; the image itself
 * (a resized JPEG data URL) lives in the browser's IndexedDB, which holds far more than localStorage.
 * When the app moves to a database, images should go to file storage (e.g. a Supabase bucket) instead.
 */
export interface PhotoMeta {
  id: string;
  caption: string;
  date: string;
}

const DB = "cronogramas-fotos";
const STORE = "photos";
/** Longest side of a stored photo, in px: sharp in print, small on disk (~150-300 KB). */
const MAX_SIDE = 1600;
const QUALITY = 0.8;

const cache = new Map<string, string>();
/** Fallback when IndexedDB is unavailable (tests, some private windows). */
const memory = new Map<string, string>();

let dbPromise: Promise<IDBDatabase | null> | null = null;
function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  dbPromise ??= new Promise((resolve) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  return dbPromise;
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        if (!db) return resolve(undefined);
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function savePhoto(id: string, dataUrl: string) {
  cache.set(id, dataUrl);
  if (!(await openDb())) return void memory.set(id, dataUrl);
  await tx("readwrite", (s) => s.put(dataUrl, id));
}

export async function loadPhoto(id: string): Promise<string | undefined> {
  if (cache.has(id)) return cache.get(id);
  const url = (await openDb()) ? await tx<string>("readonly", (s) => s.get(id)) : memory.get(id);
  if (url) cache.set(id, url);
  return url;
}

export async function deletePhoto(id: string) {
  cache.delete(id);
  memory.delete(id);
  if (await openDb()) await tx("readwrite", (s) => s.delete(id));
}

/** Loads every photo in `ids` (used before printing). */
export const loadPhotos = (ids: string[]) => Promise.all(ids.map(loadPhoto));

/** Removes stored images no longer referenced by any project (deleted stages or projects). */
export async function prunePhotos(keep: Set<string>) {
  if (!(await openDb())) return;
  const keys = ((await tx("readonly", (s) => s.getAllKeys())) ?? []) as string[];
  await Promise.all(keys.filter((k) => !keep.has(k)).map(deletePhoto));
}

/** Data URL of a stored photo, loaded on demand. */
export function usePhoto(id: string): string | undefined {
  const [url, setUrl] = useState(() => cache.get(id));
  useEffect(() => {
    let alive = true;
    loadPhoto(id).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [id]);
  return url;
}

/** Reads an image file and returns it as a JPEG data URL with its longest side <= MAX_SIDE. */
export function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(src);
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas indisponível"));
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error(`Não foi possível abrir "${file.name}". Use fotos em JPG ou PNG.`));
    };
    img.src = src;
  });
}
