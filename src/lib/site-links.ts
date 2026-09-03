const productionMain = (import.meta.env.PUBLIC_MAIN_SITE_URL || "https://literae.ch").replace(/\/$/, "");
const productionArt = (import.meta.env.PUBLIC_ART_SITE_URL || "https://art.literae.ch").replace(/\/$/, "");

/** Liens relatifs en développement pour pouvoir parcourir tout le site en local. */
export const MAIN_BASE = import.meta.env.DEV ? "" : productionMain;
export const ART_BASE = import.meta.env.DEV ? "/art" : productionArt;

export const MAIN_ORIGIN = productionMain;
export const ART_ORIGIN = productionArt;
