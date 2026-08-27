import { describe, expect, test } from 'bun:test';
import { createFavoritesStore } from './favorites-store.js';

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => {
        resolve = done;
        reject = fail;
    });
    return { promise, reject, resolve };
}

describe('favorites store', () => {
    test('loads the authenticated user favorites', async () => {
        const store = createFavoritesStore({
            request: async () => jsonResponse({ favorites: [
                { slug: 'claude-code', createdAt: 10 },
                { slug: 'cursor', createdAt: 20 },
            ] }),
        });

        const result = await store.load();

        expect(result.authenticated).toBe(true);
        expect(store.slugs()).toEqual(['cursor', 'claude-code']);
        expect(store.has('cursor')).toBe(true);
    });

    test('treats an unauthorized load as signed out', async () => {
        const store = createFavoritesStore({
            request: async () => jsonResponse({ error: 'Unauthorized' }, 401),
        });

        const result = await store.load();

        expect(result.authenticated).toBe(false);
        expect(store.slugs()).toEqual([]);
    });

    test('optimistically adds and removes favorites with idempotent methods', async () => {
        const calls = [];
        const store = createFavoritesStore({
            request: async (url, options) => {
                calls.push([url, options?.method, options?.headers?.['Content-Type'], options?.body]);
                return options?.method === 'DELETE'
                    ? new Response(null, { status: 204 })
                    : jsonResponse({ favorite: { slug: 'cursor', createdAt: 30 } }, 201);
            },
        });

        await store.toggle('cursor');
        expect(store.has('cursor')).toBe(true);
        await store.toggle('cursor');
        expect(store.has('cursor')).toBe(false);
        expect(calls).toEqual([
            ['/api/favorites/cursor', 'PUT', 'application/json', '{}'],
            ['/api/favorites/cursor', 'DELETE', 'application/json', '{}'],
        ]);
    });

    test('rolls back an optimistic change when persistence fails', async () => {
        const store = createFavoritesStore({
            request: async () => jsonResponse({ error: 'Unavailable' }, 503),
        });

        await expect(store.toggle('cursor')).rejects.toThrow('Unable to update favorite');
        expect(store.has('cursor')).toBe(false);
    });

    test('ignores a load that completes after the store is cleared', async () => {
        const response = deferred();
        const store = createFavoritesStore({ request: () => response.promise });

        const load = store.load();
        store.clear();
        response.resolve(jsonResponse({ favorites: [{ slug: 'cursor', createdAt: 20 }] }));

        expect((await load).stale).toBe(true);
        expect(store.slugs()).toEqual([]);
    });

    test('ignores a failed load after the store is cleared', async () => {
        const response = deferred();
        const store = createFavoritesStore({ request: () => response.promise });

        const load = store.load();
        store.clear();
        response.reject(new Error('Network unavailable'));

        expect((await load).stale).toBe(true);
        expect(store.slugs()).toEqual([]);
    });

    test('keeps the newer account favorites when loads finish out of order', async () => {
        const first = deferred();
        const second = deferred();
        const responses = [first, second];
        const store = createFavoritesStore({ request: () => responses.shift().promise });

        const firstLoad = store.load();
        store.clear();
        const secondLoad = store.load();
        second.resolve(jsonResponse({ favorites: [{ slug: 'claude-code', createdAt: 30 }] }));
        await secondLoad;
        first.resolve(jsonResponse({ favorites: [{ slug: 'cursor', createdAt: 20 }] }));

        expect((await firstLoad).stale).toBe(true);
        expect(store.slugs()).toEqual(['claude-code']);
    });

    test('does not let a load overwrite a pending removal', async () => {
        const removalResponse = deferred();
        const loadResponse = deferred();
        const store = createFavoritesStore({
            request: (url, options) => {
                if (options?.method === 'PUT') {
                    return jsonResponse({ favorite: { slug: 'cursor', createdAt: 20 } }, 201);
                }
                if (options?.method === 'DELETE') return removalResponse.promise;
                return loadResponse.promise;
            },
        });
        await store.toggle('cursor');

        const removal = store.toggle('cursor');
        const load = store.load();
        loadResponse.resolve(jsonResponse({ favorites: [{ slug: 'cursor', createdAt: 20 }] }));
        expect((await load).stale).toBe(true);
        removalResponse.resolve(new Response(null, { status: 204 }));
        await removal;

        expect(store.slugs()).toEqual([]);
    });

    test('ignores an in-flight toggle after an auth transition clears the store', async () => {
        const response = deferred();
        const store = createFavoritesStore({ request: () => response.promise });

        const toggle = store.toggle('cursor');
        store.clear();
        response.resolve(jsonResponse({ favorite: { slug: 'cursor', createdAt: 30 } }, 201));

        await toggle;
        expect(store.slugs()).toEqual([]);
    });
});
