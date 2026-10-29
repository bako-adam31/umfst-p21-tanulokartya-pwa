import * as db from "../db.js";
import { el, localToday } from "./app.js";
export async function renderStats() {
  const [decks, cards, logs] = await Promise.all([
    db.all("decks"),
    db.all("cards"),
    db.all("reviewLogs"),
  ]);
  const today = localToday();
  const due = await db.dueCards(today);
  const fresh = cards.filter((c) => !c.lastReviewedAt).length;
  const page = el("section", undefined, "page");
  page.append(
    el("h1", "Statisztika"),
  );
  const metrics = el("div", undefined, "metric-grid");
  [
    ["Ma esedékes", due.length],
    ["Új kártyák", fresh],
    ["Ma átismételt", logs.filter((l) => l.reviewedAt === today).length],
    ["Kártya / pakli", `${cards.length} / ${decks.length}`],
  ].forEach(([a, b]) => {
    const c = el("article", undefined, "metric-card");
    c.append(
      el("span", a, "metric-label"),
      el("strong", String(b), "metric-value"),
    );
    metrics.append(c);
  });
  page.append(metrics);
  const history = el("section", undefined, "panel chart-panel");
  history.append(
    el("h2", "Ismétlések az elmúlt 30 napban"),
  );
  const histMap = new Map();
  logs.forEach((l) =>
    histMap.set(l.reviewedAt, (histMap.get(l.reviewedAt) || 0) + 1),
  );
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return localToday(d);
  });
  chart(
    history,
    days.map((d) => ({ date: d, value: histMap.get(d) || 0 })),
    Math.max(1, ...days.map((d) => histMap.get(d) || 0)),
    "Az elmúlt 30 napban még nincs rögzített ismétlés.",
  );
  page.append(history);
  const future = el("section", undefined, "panel chart-panel");
  future.append(
    el("h2", "Esedékes ismétlések – 30 napos előrejelzés"),
    
  );
  const forecastDays = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return localToday(d);
  });
  const counts = new Map();
  cards.forEach((c) => {
    if (c.dueDate >= forecastDays[0] && c.dueDate <= forecastDays.at(-1))
      counts.set(c.dueDate, (counts.get(c.dueDate) || 0) + 1);
  });
  chart(
    future,
    forecastDays.map((d) => ({ date: d, value: counts.get(d) || 0 })),
    Math.max(1, ...forecastDays.map((d) => counts.get(d) || 0)),
    "A következő 30 napra nincs ütemezett kártya.",
  );
  page.append(future);
  return page;
}
function chart(root, rows, max, emptyText) {
  const values = rows.reduce((n, r) => n + r.value, 0);
  if (!values) {
    root.append(el("p", emptyText, "chart-empty"));
    return;
  }
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 900 190");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    rows.map((r) => `${r.date}: ${r.value}`).join(", "),
  );
  const width = 900 / rows.length;
  rows.forEach((r, i) => {
    const height = r.value ? Math.max(2, (130 * r.value) / max) : 1;
    const rect = document.createElementNS(svg.namespaceURI, "rect");
    rect.setAttribute("x", String(i * width + width * 0.24));
    rect.setAttribute("y", String(150 - height));
    rect.setAttribute("width", String(width * 0.52));
    rect.setAttribute("height", String(height));
    rect.setAttribute("rx", "3");
    rect.setAttribute("class", "chart-bar");
    rect.setAttribute("tabindex", "0");
    rect.setAttribute("aria-label", `${r.date}: ${r.value} kártya`);
    svg.append(rect);
    if (i % 5 === 0 || i === rows.length - 1) {
      const text = document.createElementNS(svg.namespaceURI, "text");
      text.setAttribute("x", String(i * width + width / 2));
      text.setAttribute("y", "175");
      text.setAttribute("text-anchor", "middle");
      text.textContent = r.date.slice(5);
      text.setAttribute("class", "chart-label");
      svg.append(text);
    }
  });
  root.append(svg);
  const caption = el();
  root.append(caption);
}
