const DB_NAME = "medkartya-db";
const DB_VERSION = 1;
let connection;

export function openDB() {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("decks"))
        db.createObjectStore("decks", { keyPath: "id" });
      if (!db.objectStoreNames.contains("cards")) {
        const cards = db.createObjectStore("cards", { keyPath: "id" });
        cards.createIndex("deckId", "deckId");
        cards.createIndex("dueDate", "dueDate");
        cards.createIndex("deckDueDate", ["deckId", "dueDate"]);
      }
      if (!db.objectStoreNames.contains("reviewLogs")) {
        const logs = db.createObjectStore("reviewLogs", { keyPath: "id" });
        logs.createIndex("reviewedAt", "reviewedAt");
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () =>
      reject(request.error || new Error("Az adatbázis nem nyitható meg."));
    request.onblocked = () =>
      reject(
        new Error(
          "Az adatbázis frissítése blokkolva van. Zárd be a régi alkalmazáslapokat.",
        ),
      );
  }).catch((error) => {
    connection = null;
    throw error;
  });
  return connection;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function all(store) {
  const db = await openDB();
  return requestResult(db.transaction(store).objectStore(store).getAll());
}
export async function get(store, key) {
  const db = await openDB();
  return requestResult(db.transaction(store).objectStore(store).get(key));
}
export async function put(store, value) {
  const db = await openDB();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value);
  return transactionDone(tx);
}
export async function remove(store, key) {
  const db = await openDB();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).delete(key);
  return transactionDone(tx);
}
function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () =>
      reject(tx.error || new Error("Az adatbázis-művelet nem sikerült."));
  });
}
export async function saveDeckWithCards(deck, cards = []) {
  const db = await openDB();
  const tx = db.transaction(["decks", "cards"], "readwrite");
  tx.objectStore("decks").put(deck);
  for (const card of cards) tx.objectStore("cards").put(card);
  return transactionDone(tx);
}
export async function deleteDeck(deckId) {
  const db = await openDB();
  const tx = db.transaction(["decks", "cards"], "readwrite");
  tx.objectStore("decks").delete(deckId);
  const req = tx
    .objectStore("cards")
    .index("deckId")
    .openKeyCursor(IDBKeyRange.only(deckId));
  req.onsuccess = () => {
    const cur = req.result;
    if (cur) {
      tx.objectStore("cards").delete(cur.primaryKey);
      cur.continue();
    }
  };
  return transactionDone(tx);
}
export async function dueCards(today, deckId) {
  const db = await openDB();
  const tx = db.transaction("cards");
  const store = tx.objectStore("cards");
  const range = IDBKeyRange.bound("", today);
  const source = deckId ? store.index("deckDueDate") : store.index("dueDate");
  const actualRange = deckId
    ? IDBKeyRange.bound([deckId, ""], [deckId, today])
    : range;
  return requestResult(source.getAll(actualRange));
}
export async function newCards(deckId) {
  const db = await openDB();
  const s = db.transaction("cards").objectStore("cards");
  if (deckId)
    return requestResult(s.index("deckId").getAll(deckId)).then((xs) =>
      xs.filter((x) => !x.lastReviewedAt),
    );
  return requestResult(s.getAll()).then((xs) =>
    xs.filter((x) => !x.lastReviewedAt),
  );
}
export async function counts(today) {
  const [decks, cards, due, logs] = await Promise.all([
    all("decks"),
    all("cards"),
    dueCards(today),
    all("reviewLogs"),
  ]);
  return {
    decks: decks.length,
    cards: cards.length,
    due: due.length,
    fresh: cards.filter((c) => !c.lastReviewedAt).length,
    reviewedToday: logs.filter((l) => l.reviewedAt === today).length,
  };
}
export async function recordReview(card, log) {
  const db = await openDB();
  const tx = db.transaction(["cards", "reviewLogs"], "readwrite");
  tx.objectStore("cards").put(card);
  tx.objectStore("reviewLogs").add(log);
  return transactionDone(tx);
}
export async function importAtomic(decks, cards) {
  const db = await openDB();
  const tx = db.transaction(["decks", "cards"], "readwrite");
  for (const d of decks) tx.objectStore("decks").add(d);
  for (const c of cards) tx.objectStore("cards").add(c);
  return transactionDone(tx);
}
