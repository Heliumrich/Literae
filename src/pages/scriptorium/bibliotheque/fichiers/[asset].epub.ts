import type { APIRoute } from 'astro';
import { fetchBooks, fetchBookFile } from '../../../../lib/books-server';
export const prerender = true;
export async function getStaticPaths() {
  const editions = new Map((await fetchBooks()).flatMap(book => book.editions).map(edition => [edition.url, edition]));
  return [...editions.values()].map(edition => ({
    params: { asset: edition.url.split('/').pop()!.replace(/\.epub$/, '') }, props: { id: edition.id },
  }));
}
export const GET: APIRoute = async ({ props }) => new Response(await fetchBookFile(props.id), {
  headers: { 'Content-Type': 'application/epub+zip' },
});
