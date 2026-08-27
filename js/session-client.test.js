import { describe, expect, test } from 'bun:test';
import { createSessionClient } from './session-client.js';

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('session client', () => {
    test('returns the cookie-backed user or null when signed out', async () => {
        const responses = [
            jsonResponse({ user: { id: 'github:42', provider: 'github' } }),
            jsonResponse({ error: 'Unauthorized' }, 401),
        ];
        const client = createSessionClient({ request: async () => responses.shift() });

        expect(await client.get()).toEqual({ id: 'github:42', provider: 'github' });
        expect(await client.get()).toBeNull();
    });

    test('loads Google provider configuration from the server', async () => {
        let call;
        const client = createSessionClient({
            request: async (url, options) => {
                call = [url, options];
                return jsonResponse({ googleClientId: 'worker-client-id' });
            },
        });

        expect(await client.getConfig()).toEqual({ googleClientId: 'worker-client-id' });
        expect(call).toEqual(['/api/auth/config', {
            headers: { 'Accept': 'application/json' },
        }]);
    });

    test('creates Google and development sessions with JSON requests', async () => {
        const calls = [];
        const client = createSessionClient({
            request: async (url, options) => {
                calls.push([url, options]);
                return jsonResponse({ user: { id: 'google:42' } }, 201);
            },
        });

        await client.createGoogle('google-token');
        await client.createDev();

        expect(calls[0]).toEqual(['/api/auth/session', {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: 'google-token' }),
        }]);
        expect(calls[1]).toEqual(['/api/auth/dev', {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: '{}',
        }]);
    });

    test('deletes the cookie session with a JSON request', async () => {
        let call;
        const client = createSessionClient({
            request: async (url, options) => {
                call = [url, options];
                return new Response(null, { status: 204 });
            },
        });

        await client.delete();

        expect(call).toEqual(['/api/auth/session', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
            keepalive: true,
        }]);
    });
});
