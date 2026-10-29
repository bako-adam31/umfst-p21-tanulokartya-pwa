import { describe, expect, it } from "vitest";
import { appAssetUrl } from "../src/ui/paths.js";

describe("appAssetUrl", () => {
  it("resolves assets from the local development root", () => {
    expect(
      appAssetUrl(
        "samples/tanulokartya.json",
        "http://localhost:5173/",
      ),
    ).toBe("http://localhost:5173/samples/tanulokartya.json");
  });

  it("keeps assets inside the GitHub Pages project base path", () => {
    expect(
      appAssetUrl(
        "samples/tanulokartya.json",
        "https://bako-adam31.github.io/umfst-p21-tanulokartya-pwa/",
      ),
    ).toBe(
      "https://bako-adam31.github.io/umfst-p21-tanulokartya-pwa/samples/tanulokartya.json",
    );
  });

  it("rejects root-relative paths that would escape a project base", () => {
    expect(() => appAssetUrl("/samples/tanulokartya.json", "http://localhost/")).toThrow(TypeError);
  });
});
