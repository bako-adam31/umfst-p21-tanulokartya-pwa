import { openDB, dueCards } from "../src/db.js";
const button = document.querySelector("#run"),
  output = document.querySelector("#result");
button.onclick = async () => {
  button.disabled = true;
  output.textContent = "Tesztadatok előkészítése…";
  try {
    const db = await openDB(),
      tx = db.transaction(["decks", "cards"], "readwrite"),
      now = new Date().toISOString(),
      today = new Date().toLocaleDateString("sv-SE");
    tx.objectStore("decks").put({
      id: "benchmark-deck",
      name: "Mérési tesztadatok",
      description: "",
      createdAt: now,
      updatedAt: now,
    });
    const store = tx.objectStore("cards");
    for (let i = 0; i < 1000; i++)
      store.put({
        id: `benchmark-${i}`,
        deckId: "benchmark-deck",
        front: `Teszt ${i}`,
        back: "Mérési adat",
        dueDate: i % 4 === 0 ? today : "2099-01-01",
        ef: 2.5,
        interval: 1,
        repetitions: 1,
      });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
    const start = performance.now(),
      due = await dueCards(today, "benchmark-deck"),
      elapsed = performance.now() - start;
    output.textContent = `Indexelt lekérdezés: ${due.length} esedékes kártya / 1 000 összes kártya.\nMért idő: ${elapsed.toFixed(2)} ms.\n figyelem! a tényleges eredmény böngésző és eszközfüggő.`;
  } catch (error) {
    output.textContent = `A mérés nem sikerült: ${error.message}`;
  } finally {
    button.disabled = false;
  }
};
