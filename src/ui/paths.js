/** Resolve a repository asset from the app document URL, without relying on Vite's runtime env object. */
export function appAssetUrl(path, pageUrl) {
  if (typeof path !== "string" || !path || path.startsWith("/")) {
    throw new TypeError("Az alkalmazás asset útvonala relatív útvonal legyen.");
  }
  if (typeof pageUrl !== "string" || !pageUrl) {
    throw new TypeError("Az alkalmazás URL-je nem érhető el.");
  }
  return new URL(path, new URL(".", pageUrl)).href;
}
