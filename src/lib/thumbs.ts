export function markThumbLoaded(img: HTMLImageElement) {
  const slot = img.closest(".thumb-slot");
  if (!slot) return;
  if (img.naturalWidth > 0) slot.classList.add("is-loaded");
}

export function hydrateThumbs(root: ParentNode = document) {
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;
  root.querySelectorAll<HTMLImageElement>(".thumb-slot img").forEach((img) => {
    if (vh) {
      const top = img.getBoundingClientRect().top;
      if (top < vh + 80) {
        img.loading = "eager";
        img.fetchPriority = "high";
      }
    }
    if (img.complete) markThumbLoaded(img);
    else img.addEventListener("load", () => markThumbLoaded(img), { once: true });
    img.addEventListener("error", () => img.closest(".thumb-slot")?.classList.add("is-loaded"), {
      once: true,
    });
  });
}
