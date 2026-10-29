import * as db from "../db.js";
import { startStudy } from "./study.js";
import {
  el,
  toast,
  showModal,
  closeModal,
  localToday,
  navigate,
} from "./app.js";
const uid = () => crypto.randomUUID();
function formField(labelText, name, value = "", tag = "input") {
  const label = el("label", labelText, "field-label");
  const input = el(tag, undefined, "text-input");
  input.name = name;
  input.required = true;
  if (tag === "textarea") input.rows = 3;
  input.value = value;
  label.append(input);
  return label;
}
function openDeckForm(deck) {
  const form = document.createElement("form");
  form.className = "form-stack";
  form.append(el("h2", deck ? "Pakli szerkesztése" : "Új pakli"));
  form.append(
    formField("Pakli neve", "name", deck?.name || ""),
    formField("Leírás", "description", deck?.description || "", "textarea"),
  );
  const actions = el("div", undefined, "form-actions");
  const cancel = el("button", "Mégse", "button secondary");
  cancel.type = "button";
  cancel.onclick = closeModal;
  const save = el("button", "Mentés", "button primary");
  save.type = "submit";
  actions.append(cancel, save);
  form.append(actions);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const data = new FormData(form),
      name = data.get("name").trim();
    if (!name) {
      toast("A pakli neve nem lehet üres.", true);
      return;
    }
    try {
      await db.put("decks", {
        id: deck?.id || uid(),
        name,
        description: data.get("description").trim(),
        createdAt: deck?.createdAt || now,
        updatedAt: now,
      });
      closeModal();
      toast(deck ? "A pakli frissült." : "A pakli elkészült.");
      await navigate("decks");
    } catch (error) {
      toast(`A mentés nem sikerült: ${error.message}`, true);
    }
  };
  showModal(form);
}
export async function renderDecks() {
  const decks = await db.all("decks"),
    cards = await db.all("cards");
  const page = el("section", undefined, "page");
  const header = el("div", undefined, "page-heading");
  header.append(
    el("h1", "Paklik"),

  );
  const add = el("button", "＋ Új pakli", "button primary");
  add.onclick = () => openDeckForm();
  header.append(add);
  page.append(header);
  const list = el("div", undefined, "deck-grid");
  if (!decks.length) {
    const empty = el("div", undefined, "empty-state");
    empty.append(
      el("span", "▤", "empty-icon"),
      el("h2", "Még nincs paklid"),
      el(
        "p",
        "Hozd létre az első paklidat, vagy töltsd be a mintapaklit az Import oldalon.",
      ),
    );
    const go = el("button", "Pakli létrehozása", "button primary");
    go.onclick = () => openDeckForm();
    empty.append(go);
    page.append(empty);
  } else
    for (const deck of decks) {
      const own = cards.filter((c) => c.deckId === deck.id),
        due = own.filter((c) => c.dueDate <= localToday()).length;
      const card = el("article", undefined, "deck-card");
      const top = el("div", undefined, "deck-card-top");
      top.append(
        el("span", "✚", "deck-icon"),
        el("span", `${own.length} kártya`, "deck-card-count"),
      );
      card.append(
        top,
        el("h2", deck.name),
        el("p", deck.description || "Leírás nélkül", "deck-description"),
        el("div", `${due} ismétlés`, "deck-due"),
      );
      const actions = el("div", undefined, "deck-actions");
      const study = el("button", "Tanulás", "button primary small");
      study.onclick = () => startStudy(deck.id);
      const browse = el("button", "Kártyák", "button secondary small");
      browse.onclick = () => showCards(deck, own);
      const edit = el("button", "Szerkesztés", "text-button");
      edit.onclick = () => openDeckForm(deck);
      const del = el("button", "Törlés", "text-button danger");
      del.onclick = async () => {
        if (
          confirm()
        ) {
          await db.deleteDeck(deck.id);
          toast("A pakli és kártyái törlődtek.");
          await navigate("decks");
        }
      };
      actions.append(study, browse, edit, del);
      card.append(actions);
      list.append(card);
    }
  if (decks.length) page.append(list);
  return page;
}
function showCards(deck, cards) {
  const wrap = el("div", undefined, "card-list-modal");
  wrap.append(el("h2", deck.name), el("p", `${cards.length} kártya`));
  const add = el("button", "＋ Kártya hozzáadása", "button primary");
  add.onclick = () => cardForm(deck);
  wrap.append(add);
  const list = el("div", undefined, "flashcard-list");
  cards.forEach((card) => {
    const item = el("article", undefined, "flashcard-item");
    item.append(el("strong", card.front), el("p", card.back));
    const edit = el("button", "Szerkesztés", "text-button");
    edit.onclick = () => cardForm(deck, card);
    const remove = el("button", "Törlés", "text-button danger");
    remove.onclick = async () => {
      if (confirm()) {
        await db.remove("cards", card.id);
        toast("A kártya törölve.");
        closeModal();
        await navigate("decks");
      }
    };
    item.append(edit, remove);
    list.append(item);
  });
  wrap.append(list);
  showModal(wrap);
}
function cardForm(deck, card) {
  const form = document.createElement("form");
  form.className = "form-stack";
  form.append(el("h2", card ? "Kártya szerkesztése" : "Új kártya"));
  form.append(
    formField("Előlap", "front", card?.front || "", "textarea"),
    formField("Hátlap", "back", card?.back || "", "textarea"),
  );
  const buttons = el("div", undefined, "form-actions");
  const cancel = el("button", "Mégse", "button secondary");
  cancel.type = "button";
  cancel.onclick = closeModal;
  const save = el("button", "Mentés", "button primary");
  save.type = "submit";
  buttons.append(cancel, save);
  form.append(buttons);
  form.onsubmit = async (e) => {
    e.preventDefault();
    const d = new FormData(form),
      now = new Date().toISOString(),
      front = d.get("front").trim(),
      back = d.get("back").trim();
    if (!front || !back) {
      toast("Az előlap és a hátlap kitöltése kötelező.", true);
      return;
    }
    const value = {
      id: card?.id || uid(),
      deckId: deck.id,
      front,
      back,
      createdAt: card?.createdAt || now,
      updatedAt: now,
      dueDate: card?.dueDate || localToday(),
      ef: card?.ef ?? 2.5,
      interval: card?.interval ?? 0,
      repetitions: card?.repetitions ?? 0,
      lastReviewedAt: card?.lastReviewedAt || null,
    };
    try {
      await db.put("cards", value);
      toast("A kártya mentve.");
      closeModal();
      await navigate("decks");
    } catch (error) {
      toast(`A kártya mentése nem sikerült: ${error.message}`, true);
    }
  };
  showModal(form);
}
