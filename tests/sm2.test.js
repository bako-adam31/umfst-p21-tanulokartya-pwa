import { describe, expect, it } from "vitest";
import { sm2, QUALITY } from "../src/sm2.js";

const fixed = new Date(2026, 0, 10, 15, 30);
const fresh = { ef: 2.5, interval: 0, repetitions: 0 };

describe("SM-2 időzítés", () => {
  it("első sikeres ismétlés után egy napot ütemez", () => {
    expect(sm2(fresh, 4, fixed)).toEqual({
      ef: 2.5,
      interval: 1,
      repetitions: 1,
      dueDate: "2026-01-11",
    });
  });
  it("második sikeres ismétlés után hat napot ütemez", () => {
    expect(
      sm2({ ef: 2.5, interval: 1, repetitions: 1 }, 4, fixed).interval,
    ).toBe(6);
  });
  it("a későbbi intervallumot a friss EF-fel szorozza és egészre kerekíti", () => {
    const result = sm2({ ef: 2.5, interval: 6, repetitions: 2 }, 5, fixed);
    expect(result.ef).toBeCloseTo(2.6);
    expect(result.interval).toBe(16);
    expect(result.repetitions).toBe(3);
  });
  it("sikertelen ismétlés nullázza a sorozatot és holnapra ütemez", () => {
    expect(
      sm2({ ef: 2.5, interval: 16, repetitions: 3 }, 2, fixed),
    ).toMatchObject({ interval: 1, repetitions: 0, dueDate: "2026-01-11" });
  });
  it("nehéz válasznál csökkenti a könnyűségi faktort", () => {
    expect(sm2(fresh, 3, fixed).ef).toBeCloseTo(2.36);
  });
  it("a könnyűségi faktor minimuma 1.3", () => {
    expect(sm2({ ef: 1.3, interval: 1, repetitions: 2 }, 0, fixed).ef).toBe(
      1.3,
    );
  });
  it("nem módosítja a bemeneti kártyát", () => {
    const source = { ...fresh };
    sm2(source, 4, fixed);
    expect(source).toEqual(fresh);
  });
  it("kezeli a hónap- és évváltást", () => {
    expect(sm2(fresh, 4, new Date(2026, 11, 31)).dueDate).toBe("2027-01-01");
  });
  it("elutasítja a hibás minősítést", () => {
    expect(() => sm2(fresh, 6, fixed)).toThrow(RangeError);
    expect(() => sm2(fresh, 2.5, fixed)).toThrow(RangeError);
  });
  it("elutasítja a hibás kártyaadatokat és dátumot", () => {
    expect(() => sm2({ ef: 1, interval: 0, repetitions: 0 }, 4, fixed)).toThrow(
      TypeError,
    );
    expect(() => sm2(fresh, 4, new Date("bad"))).toThrow(TypeError);
  });
  it("a tanulási gombok minősítései a specifikáció szerintiek", () => {
    expect(QUALITY).toEqual({ AGAIN: 0, HARD: 3, GOOD: 4, EASY: 5 });
  });
});
