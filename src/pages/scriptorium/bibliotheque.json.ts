import type { APIRoute } from 'astro';
import { fetchBooks } from '../../lib/books-server';
import { bookItem } from '../../lib/books';
import { jsonItems } from '../../lib/catalog';
export const prerender = true;
export const GET: APIRoute = async () => jsonItems((await fetchBooks()).map(book => bookItem(book)));
