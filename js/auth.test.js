import { afterEach, describe, expect, test } from 'bun:test';
import { AuthManager } from './auth.js';

function flushMicrotasks(times = 3) {
    let pending = Promise.resolve();
    for (let index = 0; index < times; index += 1) pending = pending.then(() => Promise.resolve());
    return pending;
}

afterEach(() => {
    delete global.window;
});

describe('cookie session bootstrap', () => {
    test('restores a server session independently of provider initialization', async () => {
        const user = { id: 'github:42', provider: 'github', name: 'Ada' };
        const events = [];
        const manager = new AuthManager({ get: async () => user });
        manager.onAuthChange(event => events.push(event));

        expect(await manager._restoreSession(null)).toEqual(user);
        expect(events).toEqual([{ event: 'session_restored', user, error: null }]);
    });

    test('maps a completed GitHub callback to a server-backed sign-in event', async () => {
        const user = { id: 'github:42', provider: 'github', name: 'Ada' };
        const events = [];
        const manager = new AuthManager({ get: async () => user });
        manager.onAuthChange(event => events.push(event));

        expect(await manager._restoreSession('success')).toEqual(user);
        expect(events).toEqual([{ event: 'signin', user, error: null }]);
    });

    test('reports a completed callback without a matching cookie session', async () => {
        const events = [];
        const manager = new AuthManager({ get: async () => null });
        manager.onAuthChange(event => events.push(event));

        expect(await manager._restoreSession('success')).toBeNull();
        expect(events[0]?.event).toBe('error');
        expect(events[0]?.error).toBeInstanceOf(Error);
    });

    test('uses the server provider configuration for Google initialization', async () => {
        const manager = new AuthManager({
            getConfig: async () => ({ googleClientId: 'worker-client-id' }),
        });

        await manager._loadProviderConfig();

        expect(manager.GOOGLE_CLIENT_ID).toBe('worker-client-id');
    });

    test('shares one in-flight initialization', async () => {
        let restoreSession;
        let reads = 0;
        global.window = { location: { search: '' } };
        const manager = new AuthManager({
            get: () => {
                reads += 1;
                return new Promise(resolve => { restoreSession = resolve; });
            },
            getConfig: async () => ({ googleClientId: '' }),
        });

        const first = manager.initialize();
        const second = manager.initialize();
        await flushMicrotasks();

        expect(reads).toBe(1);
        restoreSession(null);
        await Promise.all([first, second]);
        expect(manager.isInitialized).toBe(true);
    });
});

describe('session mutation ordering', () => {
    test('waits for sign-out deletion before creating a later session', async () => {
        const calls = [];
        const events = [];
        let finishDelete;
        global.window = {
            google: { accounts: { id: { disableAutoSelect: () => calls.push('google:disable') } } },
        };
        const manager = new AuthManager({
            delete: () => {
                calls.push('delete:start');
                return new Promise(resolve => {
                    finishDelete = () => {
                        calls.push('delete:end');
                        resolve();
                    };
                });
            },
            createGoogle: async credential => {
                calls.push(`create:${credential}`);
                return { id: 'google:new', provider: 'google' };
            },
        });
        manager.user = { id: 'google:old', provider: 'google' };
        manager.onAuthChange(event => events.push(event.event));

        const signOut = manager.signOut();
        const signIn = manager._handleGoogleCredential({ credential: 'new-token' });
        await flushMicrotasks();

        expect(calls).toEqual(['delete:start']);
        expect(manager.getCurrentUser()).toEqual({ id: 'google:old', provider: 'google' });

        finishDelete();
        await Promise.all([signOut, signIn]);

        expect(calls).toEqual(['delete:start', 'delete:end', 'google:disable', 'create:new-token']);
        expect(events).toEqual(['signout', 'signin']);
        expect(manager.getCurrentUser()).toEqual({ id: 'google:new', provider: 'google' });
    });

    test('keeps the current user when server-side deletion fails', async () => {
        const events = [];
        global.window = {};
        const manager = new AuthManager({ delete: async () => { throw new Error('Unavailable'); } });
        manager.user = { id: 'github:42', provider: 'github' };
        manager.onAuthChange(event => events.push(event));

        expect(await manager.signOut()).toBe(false);
        expect(manager.getCurrentUser()).toEqual({ id: 'github:42', provider: 'github' });
        expect(events[0]?.event).toBe('error');
    });
});
