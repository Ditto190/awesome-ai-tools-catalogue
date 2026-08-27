import { afterEach, describe, expect, test } from 'bun:test';

const originalFetch = global.fetch;
let moduleId = 0;

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

function jsonResponse(favorites) {
    return new Response(JSON.stringify({ favorites }), {
        headers: { 'Content-Type': 'application/json' },
    });
}

afterEach(() => {
    global.fetch = originalFetch;
    delete global.document;
});

describe('favorites UI', () => {
    test('never renders stale favorites as active while signed out', async () => {
        let authenticated = true;
        const classes = new Set();
        const attributes = new Map();
        const button = {
            dataset: { toolSlug: 'cursor', toolName: 'Cursor' },
            classList: {
                toggle: (token, force) => force ? classes.add(token) : classes.delete(token),
            },
            querySelector: () => null,
            setAttribute: (name, value) => attributes.set(name, value),
            title: '',
        };
        global.document = {
            addEventListener: () => {},
            querySelectorAll: () => [button],
        };
        global.fetch = async () => new Response(JSON.stringify({
            favorites: [{ slug: 'cursor', createdAt: 20 }],
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
        const favorites = await import(`./favorites.js?test=${++moduleId}`);
        favorites.initFavorites({ isAuthenticated: () => authenticated });
        await favorites.loadFavorites();
        expect(classes.has('favorited')).toBe(true);

        authenticated = false;
        favorites.refreshFavoriteButtons();

        expect(classes.has('favorited')).toBe(false);
        expect(attributes.get('aria-pressed')).toBe('false');
    });

    test('keeps the current user favorites across an account switch race', async () => {
        const first = deferred();
        const second = deferred();
        const responses = [first, second];
        global.document = {
            addEventListener: () => {},
            querySelectorAll: () => [],
        };
        global.fetch = () => responses.shift().promise;
        const favorites = await import(`./favorites.js?test=${++moduleId}`);
        favorites.initFavorites({ isAuthenticated: () => true });

        const firstSync = favorites.syncFavorites({ id: 'github:1' });
        const secondSync = favorites.syncFavorites({ id: 'google:2' });
        second.resolve(jsonResponse([{ slug: 'claude-code', createdAt: 30 }]));
        await secondSync;
        first.resolve(jsonResponse([{ slug: 'cursor', createdAt: 20 }]));

        expect((await firstSync).stale).toBe(true);
        expect(favorites.getFavoriteRecords()).toEqual([{ slug: 'claude-code', createdAt: 30 }]);
    });
});
