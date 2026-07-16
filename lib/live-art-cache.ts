const DATABASE_NAME = "rerun-live-episode-art";
const STORE_NAME = "episodes";

type ArtRecord = {
  episodeId: string;
  savedAt: number;
  visuals: Record<string, string>;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: "episodeId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Scene data URLs live in IndexedDB rather than localStorage: a full episode
 * exceeds the small localStorage quota, while IndexedDB can safely preserve
 * the 7-day replay's original artwork. */
export async function loadLiveEpisodeArt(episodeId: string, maxAgeMs: number) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const record = await requestValue(store.get(episodeId)) as ArtRecord | undefined;
    if (!record || Date.now() - record.savedAt <= maxAgeMs) return record?.visuals ?? {};
    await requestValue(store.delete(episodeId));
    return {};
  } finally {
    database.close();
  }
}

export async function saveLiveEpisodeArt(episodeId: string, savedAt: number, visuals: Record<string, string>) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    // Final renders complete concurrently. Merge with the latest record in the
    // same transaction so a slower scene can never overwrite faster scenes.
    const existing = await requestValue(store.get(episodeId)) as ArtRecord | undefined;
    await requestValue(store.put({
      episodeId,
      savedAt: existing?.savedAt ?? savedAt,
      visuals: { ...existing?.visuals, ...visuals },
    } satisfies ArtRecord));
  } finally {
    database.close();
  }
}
