import type { APIRoute } from 'astro';
import { listFavorites } from '../../../lib/server/favorites-repository';
import { jsonError } from '../../../lib/server/request-security';
import { requireDatabase } from '../../../lib/server/runtime-env';
import { getCookieSessionUser } from '../../../lib/server/route-auth';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
    try {
        const db = requireDatabase();
        const user = await getCookieSessionUser(cookies, db);
        if (!user) return jsonError('Unauthorized', 401);

        const favorites = await listFavorites(db, user.id);
        return Response.json({ favorites }, {
            headers: { 'Cache-Control': 'private, no-store' },
        });
    } catch (error) {
        console.error('[Favorites] Read failed:', error instanceof Error ? error.message : String(error));
        return jsonError('Favorites are temporarily unavailable', 503);
    }
};
