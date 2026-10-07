const DB = "flightsim-efb";
const STORE = "notes";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadNotes(): Promise<Record<string, string>> {
  const db = await open();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get("scratch");
    request.onsuccess = () => resolve(request.result || {});
    request.onerror = () => resolve({});
  });
}

export async function saveNotes(value: Record<string, string>) {
  const db = await open();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(value, "scratch");
}
