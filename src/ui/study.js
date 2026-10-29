import * as db from "../db.js";
import { sm2, QUALITY } from "../sm2.js";
import { el, toast, localToday } from "./app.js";
let session = null;
export async function startStudy(deckId) {
  const cards = await db.dueCards(localToday(), deckId);
  session = {
    deckId,
    cards,
    index: 0,
    reviewed: 0,
    revealed: false,
    busy: false,
  };
  document
    .querySelectorAll(".nav-link")
    .forEach((n) => n.classList.toggle("active", n.dataset.view === "study"));
  document.querySelector(".sidebar").classList.remove("open");
  await renderStudyInto();
}
export async function renderStudy() {
  if (!session) return emptyStudy();
  return buildStudy();
}
function emptyStudy() {
  const p = el("section", undefined, "page");
  p.append(
    el("h1", "Tanulás"),
  );
  db.all("decks").then((ds) => {
    const row = el("div", undefined, "study-deck-select");
    const all = el("button", "Összes esedékes kártya", "button primary");
    all.onclick = () => startStudy();
    row.append(all);
    ds.forEach((d) => {
      const b = el("button", d.name, "button secondary");
      b.onclick = () => startStudy(d.id);
      row.append(b);
    });
    p.append(row);
  });
  const note = el("div", undefined, "study-empty");
  note.append(
    el("h2", "Tanulásra kész?"),
    
  );
  p.append(note);
  return p;
}
export async function renderStudyInto() {
  const app = document.querySelector("#app");
  app.replaceChildren(buildStudy());
}
function buildStudy() {
  const p = el("section", undefined, "page");
  p.append(el("div", "TANULÁSI MÓD", "eyebrow"), el("h1", "Tanulás"));
  if (!session || session.index >= session.cards.length) {
    const done = el("div", undefined, "completion-card");
    done.append(
      el("span", "✓", "completion-icon"),
      el(
        "h2",
        session?.reviewed
          ? `Szép munka! ${session.reviewed} kártyát átismételtél.`
          : "Nincs több esedékes kártya",
      ),
      el(
        "p",
        session?.reviewed
          ? "A haladásod mentve van az eszközödön."
          : "A kiválasztott pakliban most nincs esedékes kártya.",
      ),
    );
    const again = el("button", "Vissza az áttekintéshez", "button primary");
    again.onclick = () => {
      session = null;
      document.querySelector('[data-view="overview"]').click();
    };
    p.append(done, again);
    return p;
  }
  const card = session.cards[session.index];
  const top = el("div", undefined, "study-progress");
  top.append(
    el("span", `Ismétlés ${session.reviewed + 1} / ${session.cards.length}`),
    el("span", `${Math.max(0, session.cards.length - session.index)} hátra`),
  );
  const progress = document.createElement("progress");
  progress.max = session.cards.length;
  progress.value = session.index;
  progress.setAttribute("aria-label", "Tanulási folyamat");
  p.append(top, progress);
  const box = el("article", undefined, "study-card");
  box.append(
    el("div", "KÁRTYA ELŐLAPJA", "eyebrow"),
    el("div", card.front, "study-front"),
  );
  if (session.revealed) {
    const divider = el("div", undefined, "answer-divider");
    box.append(
      divider,
      el("div", "VÁLASZ", "eyebrow"),
      el("div", card.back, "study-back"),
    );
  }
  const deck = db.get("decks", card.deckId).then((d) => {
    if (d) box.prepend(el("span", d.name, "tag"));
  });
  const controls = el("div", undefined, "study-controls");
  if (!session.revealed) {
    const reveal = el(
      "button",
      "Mutasd a választ",
      "button primary reveal-button",
    );
    reveal.onclick = () => {
      session.revealed = true;
      renderStudyInto();
    };
    controls.append(reveal);
  } else {
    const map = [
      [QUALITY.AGAIN, "1", "Újra", "rating-again"],
      [QUALITY.HARD, "2", "Nehéz", "rating-hard"],
      [QUALITY.GOOD, "3", "Jó", "rating-good"],
      [QUALITY.EASY, "4", "Könnyű", "rating-easy"],
    ];
    map.forEach(([quality, key, label, cls]) => {
      const b = el("button", undefined, `rating-button ${cls}`);
      b.append(el("strong", label), el("small", ` ${key}`));
      b.onclick = () => rate(quality);
      controls.append(b);
    });
  }
  p.append(
    box,
    controls,
    el(
      "p",
      "Billentyűparancs: szóköz a válaszhoz, 1–4 az értékeléshez.",
      "keyboard-hint",
    ),
  );
  void deck;
  return p;
}
async function rate(quality) {
  if (!session || session.busy) return;
  session.busy = true;
  const card = session.cards[session.index];
  try {
    const result = sm2(card, quality, new Date());
    const reviewedAt = localToday();
    await db.recordReview(
      {
        ...card,
        ...result,
        lastReviewedAt: reviewedAt,
        updatedAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        cardId: card.id,
        deckId: card.deckId,
        reviewedAt,
        quality,
      },
    );
    session.index++;
    session.reviewed++;
    session.revealed = false;
    session.busy = false;
    document.querySelector("#nav-due").textContent = await db
      .dueCards(localToday())
      .then((xs) => xs.length);
    await renderStudyInto();
  } catch (error) {
    session.busy = false;
    toast(`Nem sikerült menteni az ismétlést: ${error.message}`, true);
  }
}
document.addEventListener("keydown", (e) => {
  if (!session) return;
  const target = e.target;
  const typing = target.matches?.(
    'input,textarea,select,[contenteditable="true"]',
  );
  if (typing || !session.cards || session.index >= session.cards.length) return;
  if (e.code === "Space" && !session.revealed) {
    e.preventDefault();
    session.revealed = true;
    renderStudyInto();
  } else if (
    session.revealed &&
    ["Digit1", "Digit2", "Digit3", "Digit4"].includes(e.code)
  ) {
    e.preventDefault();
    const q = { Digit1: 0, Digit2: 3, Digit3: 4, Digit4: 5 }[e.code];
    rate(q);
  }
});
