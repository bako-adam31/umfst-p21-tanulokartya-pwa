import * as db from "../db.js";
import { renderDecks } from "./decks.js";
import { renderStudy, startStudy } from "./study.js";
import { renderStats } from "./stats.js";
import { renderTransfer } from "./import-export.js";

const app = document.querySelector("#app");
const modal = document.querySelector("#modal");
export const showModal = (html) => {
  document.querySelector("#modal-content").replaceChildren();
  document.querySelector("#modal-content").append(html);
  if (!modal.open) modal.showModal();
};
export const closeModal = () => modal.close();
export function toast(message, error = false) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.toggle("error", error);
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3600);
}
export const el = (tag, text, cls) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
};

async function renderOverview() {
  const today = localToday();
  const c = await db.counts(today);
  const page = el("section", undefined, "page");
  page.append(
    el("h1", "Vizsgafelkészítő tanulókártyák"),
  );
  const metrics = el("div", undefined, "metric-grid");
  [
    ["Ma esedékes", c.due, "kártya"],
    ["Új kártyák", c.fresh, "a gyűjteményben"],
    ["Ma átismételt", c.reviewedToday, "kártya"],
    ["Összes pakli", c.decks, "tanulópakli"],
  ].forEach(([a, b, d]) => {
    const card = el("article", undefined, "metric-card");
    card.append(
      el("span", a, "metric-label"),
      el("strong", String(b), "metric-value"),
      el("small", d),
    );
    metrics.append(card);
  });
  page.append(metrics);
  const feature = el("section", undefined, "study-prompt");
  feature.append(
    el("div", "NAPI ISMÉTLÉS", "eyebrow"),
    el(
      "h2",
      c.due ? `Vár rád ${c.due} esedékes kártya` : "Minden ismétlésed kész",
    ),
  );
  const start = el(
    "button",
    c.due ? "Tanulás indítása" : "Paklik megtekintése",
    "button primary",
  );
  start.onclick = () => (c.due ? startStudy() : navigate("decks"));
  feature.append(start);
  page.append(feature);
  const lower = el("div", undefined, "overview-lower");
  const welcome = el("article", undefined, "panel");
  welcome.append(
    el("h3", "Kezdd itt"),
    el(
      "p",
    ),
    buttonLink("Paklik megnyitása", "decks"),
  );
  const privacy = el("article", undefined, "panel soft-panel");
  privacy.append(
    el(
      "p",
      "A kártyák a böngésződ helyi adatbázisában tárolódnak.",
    ),
  );
  lower.append(welcome, privacy);
  page.append(lower);
  return page;
}
function buttonLink(label, view) {
  const b = el("button", label, "button secondary");
  b.onclick = () => navigate(view);
  return b;
}
export function localToday(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export async function navigate(view = "overview") {
  document
    .querySelectorAll(".nav-link")
    .forEach((n) => n.classList.toggle("active", n.dataset.view === view));
  document.querySelector(".sidebar").classList.remove("open");
  app.setAttribute("aria-busy", "true");
  try {
    let page;
    if (view === "overview") page = await renderOverview();
    else if (view === "decks") page = await renderDecks();
    else if (view === "study") page = await renderStudy();
    else if (view === "stats") page = await renderStats();
    else page = await renderTransfer();
    app.replaceChildren(page);
    app.setAttribute("aria-busy", "false");
  } catch (error) {
    app.setAttribute("aria-busy", "false");
    const panel = el("section", undefined, "page");
    panel.append(
      el("h1", "Nem sikerült betölteni az adatokat"),
      el("p", error.message, "error-text"),
      buttonLink("Újrapróbálás", view),
    );
    app.replaceChildren(panel);
  }
}
document
  .querySelectorAll(".nav-link")
  .forEach((button) =>
    button.addEventListener("click", () => navigate(button.dataset.view)),
  );
document.querySelector("#menu-toggle").onclick = () =>
  document.querySelector(".sidebar").classList.toggle("open");
document.querySelector("#today-label").textContent = new Intl.DateTimeFormat(
  "hu-HU",
  { dateStyle: "full" },
).format(new Date());
document.querySelector("#modal").addEventListener("click", (e) => {
  if (e.target === modal) modal.close();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal.open) modal.close();
});
db.openDB()
  .then(async () => {
    const n = (await db.counts(localToday())).due;
    document.querySelector("#nav-due").textContent = n;
    await navigate();
  })
  .catch((error) => {
    app.setAttribute("aria-busy", "false");
    app.replaceChildren(el("section", undefined, "page"));
    const p = app.firstElementChild;
    p.append(
      el("h1", "Az adattár nem érhető el"),
      el(
        "p",
        `A helyi adatbázis megnyitása nem sikerült: ${error.message}. Próbáld újratölteni az alkalmazást.`,
        `error-text`,
      ),
    );
  });
if ("serviceWorker" in navigator)
  window.addEventListener("load", () =>
    navigator.serviceWorker
      .register("./sw.js")
      .catch((error) =>
        toast(
          `Az offline mód előkészítése nem sikerült: ${error.message}`,
          true,
        ),
      ),
  );
