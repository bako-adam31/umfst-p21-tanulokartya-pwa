export const QUALITY = Object.freeze({ AGAIN: 0, HARD: 3, GOOD: 4, EASY: 5 });

function dateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function sm2(card, quality, today = new Date()) {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5)
    throw new RangeError("A minőség értéke 0 és 5 közötti egész szám lehet.");
  if (
    !card ||
    !Number.isFinite(card.ef) ||
    card.ef < 1.3 ||
    !Number.isInteger(card.interval) ||
    card.interval < 0 ||
    !Number.isInteger(card.repetitions) ||
    card.repetitions < 0
  )
    throw new TypeError("Érvénytelen SM-2 kártyaadat.");
  if (!(today instanceof Date) || Number.isNaN(today.getTime()))
    throw new TypeError("A dátum érvénytelen.");
  const delta = 5 - quality;
  const ef = Math.max(1.3, card.ef + (0.1 - delta * (0.08 + delta * 0.02)));
  let repetitions;
  let interval;
  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions = card.repetitions + 1;
    if (card.repetitions === 0) interval = 1;
    else if (card.repetitions === 1) interval = 6;
    else interval = Math.round(card.interval * ef);
  }
  const next = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  next.setDate(next.getDate() + interval);
  return { ef, interval, repetitions, dueDate: dateString(next) };
}
