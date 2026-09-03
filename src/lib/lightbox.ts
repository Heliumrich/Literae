import { pickAssetSrc } from "./asset-tier";

function downloadUrl(src: string) {
  return src.includes("?") ? `${src}&download` : `${src}?download`;
}

export type LightboxItem = {
  alt: string;
  href?: string | null;
  medium?: string | null;
  large?: string | null;
  xlarge?: string | null;
  original?: string | null;
};

let gallery: LightboxItem[] = [];
let index = 0;
let bound = false;
let qualityMax = false;
let returnFocus: HTMLElement | null = null;

function itemSrc(item: LightboxItem) {
  if (qualityMax && item.original) return item.original;
  return pickAssetSrc({
    dataset: {
      medium: item.medium || "",
      large: item.large || "",
      xlarge: item.xlarge || "",
      original: item.original || "",
    },
  });
}

function fromEl(el: HTMLElement): LightboxItem {
  return {
    alt: el.getAttribute("data-alt") || el.getAttribute("alt") || "",
    href: el.dataset.href || "",
    medium: el.dataset.medium,
    large: el.dataset.large,
    xlarge: el.dataset.xlarge,
    original: el.dataset.original,
  };
}

export function setLightboxGallery(items: LightboxItem[]) {
  gallery = items.filter((i) => i.large || i.medium || i.original);
}

function ensureLightbox() {
  let root = document.getElementById("lightbox");
  if (root) return root;
  root = document.createElement("div");
  root.id = "lightbox";
  root.className = "lightbox";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Visionneuse d’art");
  root.tabIndex = -1;
  root.innerHTML = `
    <button type="button" class="lightbox-close" aria-label="Fermer">×</button>
    <button type="button" class="lightbox-quality" aria-pressed="false">
      <span>Qualité originale</span>
    </button>
    <button type="button" class="lightbox-prev" aria-label="Œuvre précédente">‹</button>
    <img class="lightbox-img" alt="" />
    <button type="button" class="lightbox-next" aria-label="Œuvre suivante">›</button>
    <p class="lightbox-cap">
      <span class="lightbox-cap-center">
      <a class="lightbox-cap-link" href="#"></a>
      <a class="lightbox-dl" hidden aria-label="Télécharger">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M12 4v12"></path>
          <path d="M7 11l5 5 5-5"></path>
          <path d="M5 20h14"></path>
        </svg>
      </a>
      </span>
    </p>
  `;
  document.body.appendChild(root);
  root.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.closest(".lightbox-cap-link")) return;
    if (t.closest(".lightbox-dl")) return;
    const quality = t.closest<HTMLButtonElement>(".lightbox-quality");
    if (quality) {
      qualityMax = !qualityMax;
      quality.setAttribute("aria-pressed", String(qualityMax));
      quality.classList.toggle("is-active", qualityMax);
      show();
      return;
    }
    if (t.classList.contains("lightbox-prev")) {
      step(-1);
      return;
    }
    if (t.classList.contains("lightbox-next")) {
      step(1);
      return;
    }
    const img = root.querySelector<HTMLImageElement>(".lightbox-img");
    if (img && (t === img || img.contains(t)) && clickOnPaintedImage(img, e)) return;
    closeLightbox();
  });
  return root;
}

function show() {
  const item = gallery[index];
  const root = ensureLightbox();
  if (!item) return;
  const img = root.querySelector<HTMLImageElement>(".lightbox-img");
  const cap = root.querySelector<HTMLElement>(".lightbox-cap");
  const prev = root.querySelector<HTMLElement>(".lightbox-prev");
  const next = root.querySelector<HTMLElement>(".lightbox-next");
  const quality = root.querySelector<HTMLButtonElement>(".lightbox-quality");
  if (img) {
    img.src = itemSrc(item);
    img.alt = item.alt;
  }
  const link = root.querySelector<HTMLAnchorElement>(".lightbox-cap-link");
  if (link) {
    link.textContent = item.alt;
    if (item.href) {
      link.href = item.href;
      link.classList.add("is-link");
    } else {
      link.removeAttribute("href");
      link.classList.remove("is-link");
    }
  } else if (cap) {
    cap.textContent = item.alt;
  }
  const dl = root.querySelector<HTMLAnchorElement>(".lightbox-dl");
  if (dl) {
    if (item.original) {
      dl.href = downloadUrl(item.original);
      dl.hidden = false;
    } else {
      dl.removeAttribute("href");
      dl.hidden = true;
    }
  }
  const many = gallery.length > 1;
  if (quality) {
    quality.hidden = !item.original;
    quality.setAttribute("aria-pressed", String(qualityMax));
    quality.classList.toggle("is-active", qualityMax);
  }
  prev?.classList.toggle("hidden", !many);
  next?.classList.toggle("hidden", !many);
  root.hidden = false;
  document.body.style.overflow = "hidden";
  root.querySelector<HTMLButtonElement>(".lightbox-close")?.focus();
}

export function openLightbox(el: HTMLElement) {
  returnFocus = el;
  const current = fromEl(el);
  if (gallery.length > 1) {
    const found = gallery.findIndex(
      (item) =>
        item.original === el.dataset.original ||
        item.large === el.dataset.large ||
        item.alt === el.getAttribute("data-alt"),
    );
    index = found >= 0 ? found : 0;
  } else {
    gallery = [current];
    index = 0;
  }
  show();
}

function clickOnPaintedImage(img: HTMLImageElement, e: MouseEvent) {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh) return true;
  const rect = img.getBoundingClientRect();
  const scale = Math.min(rect.width / nw, rect.height / nh);
  const dw = nw * scale;
  const dh = nh * scale;
  const x = rect.left + (rect.width - dw) / 2;
  const y = rect.top + (rect.height - dh) / 2;
  return e.clientX >= x && e.clientX <= x + dw && e.clientY >= y && e.clientY <= y + dh;
}

function step(delta: number) {
  if (gallery.length < 2) return;
  index = (index + delta + gallery.length) % gallery.length;
  show();
}

export function closeLightbox() {
  const root = document.getElementById("lightbox");
  if (!root) return;
  root.hidden = true;
  const img = root.querySelector<HTMLImageElement>(".lightbox-img");
  if (img) img.src = "";
  document.body.style.overflow = "";
  returnFocus?.focus();
  returnFocus = null;
}

export function initLightbox() {
  ensureLightbox();
  if (bound) return;
  bound = true;
  document.addEventListener("keydown", (e) => {
    const root = document.getElementById("lightbox");
    if (!root || root.hidden) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
    if (e.key === "Tab") {
      const focusable = [...root.querySelectorAll<HTMLElement>(
        'button:not([hidden]), a[href]:not([hidden])',
      )].filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  document.addEventListener("click", (e) => {
    const trigger = (e.target as HTMLElement).closest<HTMLElement>("[data-lightbox]");
    if (!trigger) return;
    e.preventDefault();
    openLightbox(trigger);
  });
}
