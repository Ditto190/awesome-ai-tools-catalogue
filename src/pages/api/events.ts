import type { APIRoute } from 'astro';
import { normalizeClientEvent } from '../../lib/analytics-events.js';
import { trackRequest } from '../../lib/server/analytics';
import { isAllowedMutationRequest, jsonError } from '../../lib/server/request-security';

export const prerender = false;

const MAX_BODY_BYTES = 8_192;
const MAX_EVENTS = 20;

export const POST: APIRoute = async ({ request }) => {
    if (!isAllowedMutationRequest(request, import.meta.env.DEV)) return jsonError('Invalid request origin', 403);

    const contentLength = Number(request.headers.get('Content-Length') ?? 0);
    if (contentLength > MAX_BODY_BYTES) return jsonError('Request body too large', 413);

    let body: { events?: unknown };
    try {
        const text = await request.text();
        if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return jsonError('Request body too large', 413);
        body = JSON.parse(text) as { events?: unknown };
    } catch {
        return jsonError('Invalid request body', 400);
    }

    const events = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS) : [];
    for (const input of events) {
        const event = normalizeClientEvent(input);
        if (!event) continue;
        trackRequest(request, event.event, event);
    }

    return new Response(null, {
        status: 204,
        headers: { 'Cache-Control': 'no-store' },
    });
};
