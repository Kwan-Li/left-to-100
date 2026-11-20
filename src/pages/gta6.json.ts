import type { APIRoute } from 'astro';
import { data } from '../data';

/** The open dataset, served as a static file. */
export const GET: APIRoute = () =>
  new Response(JSON.stringify(data, null, 2), { headers: { 'Content-Type': 'application/json' } });
