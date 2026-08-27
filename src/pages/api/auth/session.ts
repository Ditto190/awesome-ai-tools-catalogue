import type { APIRoute } from 'astro';
import { verifyGoogleCredential } from '../../../lib/server/google-auth';
import { isAllowedMutationRequest, jsonError } from '../../../lib/server/request-security';
import { getGoogleClientId, requireDatabase } from '../../../lib/server/runtime-env';
import { getCookieSessionUser, toClientUser } from '../../../lib/server/route-auth';
import {
    createUserSession,
    deleteUserSession,
    SESSION_COOKIE_NAME,
    sessionCookieOptions,
} from '../../../lib/server/user-session';

export const prerender = false;

const responseHeaders = { 'Cache-Control': 'no-store' };

export const GET: APIRoute = async ({ cookies }) => {
    try {
        const user = await getCookieSessionUser(cookies, requireDatabase());
        if (!user) return jsonError('Unauthorized', 401);
        return Response.json({ user: toClientUser(user) }, { headers: responseHeaders });
    } catch (error) {
        console.error('[Auth Session] Read failed:', error instanceof Error ? error.message : String(error));
        return jsonError('Authentication service unavailable', 503);
    }
};

export const POST: APIRoute = async ({ request, cookies }) => {
    if (!isAllowedMutationRequest(request, import.meta.env.DEV)) return jsonError('Invalid request origin', 403);

    let body: { credential?: unknown };
    try {
        body = await request.json() as { credential?: unknown };
    } catch {
        return jsonError('Invalid request body', 400);
    }
    if (typeof body.credential !== 'string' || body.credential.length > 16_384) {
        return jsonError('Invalid Google credential', 400);
    }

    const clientId = getGoogleClientId();
    if (!clientId) return jsonError('Google authentication is not configured', 503);

    let profile;
    try {
        profile = await verifyGoogleCredential(body.credential, clientId);
    } catch (error) {
        console.error('[Auth Session] Google verification failed:', error instanceof Error ? error.message : String(error));
        return jsonError('Google authentication failed', 401);
    }

    try {
        const session = await createUserSession(requireDatabase(), profile);
        cookies.set(
            SESSION_COOKIE_NAME,
            session.token,
            sessionCookieOptions(new URL(request.url)),
        );
        return Response.json({ user: toClientUser(session.user) }, {
            status: 201,
            headers: responseHeaders,
        });
    } catch (error) {
        console.error('[Auth Session] Session creation failed:', error instanceof Error ? error.message : String(error));
        return jsonError('Authentication service unavailable', 503);
    }
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
    if (!isAllowedMutationRequest(request, import.meta.env.DEV)) return jsonError('Invalid request origin', 403);

    const token = cookies.get(SESSION_COOKIE_NAME)?.value ?? '';
    try {
        await deleteUserSession(requireDatabase(), token);
        const { httpOnly, sameSite, secure, path } = sessionCookieOptions(new URL(request.url));
        cookies.delete(SESSION_COOKIE_NAME, { httpOnly, sameSite, secure, path });
        return new Response(null, { status: 204, headers: responseHeaders });
    } catch (error) {
        console.error('[Auth Session] Sign-out failed:', error instanceof Error ? error.message : String(error));
        return jsonError('Authentication service unavailable', 503);
    }
};
