import { biblePwaResponse } from "../../../lib/offline/releases-route";
import type { APIRoute } from "astro";
import { getBibleDb } from "../../../lib/bible-db";
import { readBiblePassage } from "../../../lib/bible-query";

export const prerender = false;

export const GET: APIRoute = async ({ url, request }) => {
  // PWA transfers share the existing VPS endpoint; verse requests stay unchanged.
  if (url.searchParams.has("pwa")) return biblePwaResponse(url, request.signal);
  let db: ReturnType<typeof getBibleDb> | undefined;
  try {
    db = getBibleDb();
    return Response.json(readBiblePassage(db, url.searchParams), {
      headers: { "Cache-Control": "public, max-age=3600", "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error && error.message === "Paramètres manquants" ? error.message : String(error) }, {
      status: error instanceof Error && error.message === "Paramètres manquants" ? 400 : 500,
    });
  } finally { db?.close(); }
};
