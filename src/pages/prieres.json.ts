import type { APIRoute } from "astro";
import { fetchAllFromDirectus } from "../lib/directus";
import { jsonItems } from "../lib/catalog";
import { prayerToIndex, type Prayer } from "../lib/prayer";

export const prerender = true;

export const GET: APIRoute = async () => {
  const prayers = await fetchAllFromDirectus<Prayer>(
    "prayers?filter[status][_eq]=published&fields=id,slug,sort,title_latin,title_french,text_latin,text_french,description,tags&sort=sort,title_french",
  );

  return jsonItems(prayers.map(prayerToIndex));
};
