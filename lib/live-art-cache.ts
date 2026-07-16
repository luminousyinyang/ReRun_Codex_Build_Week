const DATABASE_NAME = "rerun-live-episode-art";
const DATABASE_VERSION = 2;
const STORE_NAME = "scene-assets";

type SceneAsset = {
  key: string;
  episodeId: string;
  sceneId: string;
  savedAt: number;
  dataUrl: string;
};

function keyFor(episodeId: string, sceneId: string) {
  return `${episodeId}:${sceneId}`;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
    };
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

/** One durable Safari IndexedDB record per completed scene. Unlike the old
 * episode-sized record, concurrent completions cannot overwrite each other. */
export async function loadLiveEpisodeArt(episodeId: string, sceneIds: string[], maxAgeMs: number) {
  const database = await openDatabase();
  try {
    const store = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME);
    const records = await Promise.all(sceneIds.map((sceneId) => requestValue(store.get(keyFor(episodeId, sceneId)) as IDBRequest<SceneAsset | undefined>)));
    return Object.fromEntries(records.flatMap((record) => record && Date.now() - record.savedAt <= maxAgeMs ? [[record.sceneId, record.dataUrl]] : []));
  } finally {
    database.close();
  }
}

export async function saveLiveEpisodeArt(episodeId: string, sceneId: string, savedAt: number, dataUrl: string) {
  const database = await openDatabase();
  try {
    const store = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME);
    await requestValue(store.put({ key: keyFor(episodeId, sceneId), episodeId, sceneId, savedAt, dataUrl } satisfies SceneAsset));
  } finally {
    database.close();
  }
}
