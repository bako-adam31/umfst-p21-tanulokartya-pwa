import * as db from "../db.js";
import { el, toast, localToday } from "./app.js";
import { appAssetUrl } from "./paths.js";
const uid = () => crypto.randomUUID();
export async function renderTransfer() {
  const [decks, cards] = await Promise.all([db.all("decks"), db.all("cards")]);
  const page = el("section", undefined, "page");
  page.append(
    el("h1", "Import / export"),
  );
  const grid = el("div", undefined, "transfer-grid");
  const imp = el("section", undefined, "panel transfer-panel");
  imp.append(
    el("span", "⇧", "transfer-icon"),
    el("h2", "Pakli importálása"),
    el(
      "p",
      "Tölts fel egy JSON fájlt.",
    ),
  );
  const fileLabel = el("label", "JSON-fájl kiválasztása", "field-label");
  const input = el("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.setAttribute("aria-label", "JSON-fájl kiválasztása");
  fileLabel.append(input);
  imp.append(fileLabel);
  const go = el("button", "Fájl importálása", "button primary");
  go.onclick = () => input.files[0] && importFile(input.files[0]);
  imp.append(go);
  const sample = el(
    "button",
    "Anatómia mintapakli betöltése",
    "button secondary",
  );
  sample.onclick = loadSample;
  imp.append(sample);
  const exp = el("section", undefined, "panel transfer-panel");
  exp.append(
    el("span", "⇩", "transfer-icon"),
    el("h2", "Adatok exportálása"),
    el(
      "p",
      "Az exportált fájl később visszatölthető.",
    ),
  );
  const all = el("button", "Teljes gyűjtemény exportálása", "button primary");
  all.onclick = () =>
    download(
      { schemaVersion: 1, exportedAt: new Date().toISOString(), decks, cards },
      "medkartya-teljes-export.json",
    );
  exp.append(all);
  if (decks.length) {
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Exportálandó pakli");
    select.className = "text-input";
    decks.forEach((d) => {
      const o = document.createElement("option");
      o.value = d.id;
      o.textContent = d.name;
      select.append(o);
    });
    const single = el(
      "button",
      "Kiválasztott pakli exportálása",
      "button secondary",
    );
    single.onclick = () => {
      const deck = decks.find((d) => d.id === select.value);
      download(
        {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          decks: [deck],
          cards: cards.filter((c) => c.deckId === deck.id),
        },
        `medkartya-${slug(deck.name)}.json`,
      );
    };
    exp.append(select, single);
  }
  const sampleDl = el("a", "Példa JSON letöltése", "text-link");
  sampleDl.href = appAssetUrl("samples/tanulokartya.json", document.URL);
  sampleDl.download = "tanulokartya.json";
  exp.append(sampleDl);
  grid.append(imp, exp);
  page.append(grid);
  const info = el("section", undefined, "panel schema-panel");

  page.append(info);
  return page;
}
function slug(s) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
function download(obj, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function loadSample() {
  try {
    const r = await fetch(appAssetUrl("samples/tanulokartya.json", document.URL));
    if (!r.ok) throw new Error("A mintafájl nem érhető el.");
    const value = await r.json();
    await processImport(value);
    toast("Az anatómia mintapakli betöltődött.");
  } catch (e) {
    toast(`A mintapakli betöltése nem sikerült: ${e.message}`, true);
  }
}
async function importFile(file) {
  try {
    if (file.size > 5_000_000) throw new Error("A fájl legfeljebb 5 MB lehet.");
    const value = JSON.parse(await file.text());
    await processImport(value);
    toast("Az import sikeres, a pakli új azonosítókat kapott.");
  } catch (e) {
    toast(`Importálási hiba: ${e.message}`, true);
  }
}
async function processImport(doc) {
  validate(doc);
  const deckMap = new Map(doc.decks.map((d) => [d.id, uid()]));
  const now = new Date().toISOString();
  const decks = doc.decks.map((d) => ({
    ...d,
    id: deckMap.get(d.id),
    createdAt: now,
    updatedAt: now,
  }));
  const cards = doc.cards.map((c) => ({
    ...c,
    id: uid(),
    deckId: deckMap.get(c.deckId),
    createdAt: now,
    updatedAt: now,
    image: undefined,
  }));
  await db.importAtomic(decks, cards);
}
const date = /^\d{4}-\d{2}-\d{2}$/;
function validDate(value) {
  if (typeof value !== "string" || !date.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number),
    test = new Date(y, m - 1, d);
  return (
    test.getFullYear() === y &&
    test.getMonth() === m - 1 &&
    test.getDate() === d
  );
}
function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
function validate(doc) {
  if (
    !doc ||
    typeof doc !== "object" ||
    doc.schemaVersion !== 1 ||
    !validTimestamp(doc.exportedAt) ||
    !Array.isArray(doc.decks) ||
    !Array.isArray(doc.cards)
  )
    throw new Error(
      "Nem támogatott fájl: schemaVersion 1, exportedAt, decks és cards szükséges.",
    );
  if (doc.decks.length > 1000 || doc.cards.length > 10000)
    throw new Error(
      "Az import legfeljebb 1 000 paklit és 10 000 kártyát tartalmazhat.",
    );
  const ids = new Set(),
    deckIds = new Set();
  for (const d of doc.decks) {
    if (
      !d ||
      typeof d.id !== "string" ||
      !d.id ||
      ids.has(d.id) ||
      typeof d.name !== "string" ||
      !d.name.trim() ||
      typeof d.description !== "string" ||
      !validTimestamp(d.createdAt) ||
      !validTimestamp(d.updatedAt)
    )
      throw new Error(
        "Érvénytelen vagy ismétlődő pakli azonosító vagy pakliadat.",
      );
    ids.add(d.id);
    deckIds.add(d.id);
  }
  for (const c of doc.cards) {
    if (
      !c ||
      typeof c.id !== "string" ||
      !c.id ||
      ids.has(c.id) ||
      typeof c.deckId !== "string" ||
      !deckIds.has(c.deckId) ||
      typeof c.front !== "string" ||
      !c.front.trim() ||
      typeof c.back !== "string" ||
      !c.back.trim() ||
      !validTimestamp(c.createdAt) ||
      !validTimestamp(c.updatedAt) ||
      !validDate(c.dueDate) ||
      !(c.lastReviewedAt === null || validDate(c.lastReviewedAt)) ||
      !Number.isFinite(c.ef) ||
      c.ef < 1.3 ||
      !Number.isInteger(c.interval) ||
      c.interval < 0 ||
      !Number.isInteger(c.repetitions) ||
      c.repetitions < 0
    )
      throw new Error(
        "Érvénytelen, ismétlődő vagy paklihoz nem kapcsolódó kártyaadat.",
      );
    if ("image" in c)
      throw new Error(
        "A képmellékletek importálása ebben a verzióban nem támogatott.",
      );
    ids.add(c.id);
  }
}
