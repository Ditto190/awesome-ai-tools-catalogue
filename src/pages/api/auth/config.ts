import type { APIRoute } from 'astro';
import { getGoogleClientId } from '../../../lib/server/runtime-env';

export const prerender = false;

export const GET: APIRoute = () => Response.json({
    googleClientId: getGoogleClientId(),
}, {
    headers: { 'Cache-Control': 'no-store' },
});
