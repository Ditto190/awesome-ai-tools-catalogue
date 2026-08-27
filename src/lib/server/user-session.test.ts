import { describe, expect, test } from 'bun:test';
import {
    SESSION_COOKIE_NAME,
    createUserSession,
    getSessionUser,
    hashSessionToken,
    sessionCookieOptions,
    type IdentityProfile,
} from './user-session';
import type { Database } from './db';
import { toClientUser } from './route-auth';

function makeDatabase(firstResult: unknown = null) {
    const prepared: Array<{ sql: string; values: unknown[] }> = [];
    const batches: unknown[][] = [];
    const db = {
        prepare(sql: string) {
            return {
                bind(...values: unknown[]) {
                    const statement = {
                        sql,
                        values,
                        first: async () => firstResult,
                        run: async () => ({ success: true }),
                    };
                    prepared.push({ sql, values });
                    return statement;
                },
            };
        },
        async batch(statements: unknown[]) {
            batches.push(statements);
            return statements.map(() => ({ success: true }));
        },
    } as unknown as Database;
    return { db, prepared, batches };
}

const profile: IdentityProfile = {
    provider: 'github',
    providerUserId: '42',
    name: 'Ada',
    email: 'ada@example.com',
    picture: 'https://example.com/ada.png',
    githubUsername: 'ada',
    emailVerified: true,
};

describe('server user sessions', () => {
    test('hashes opaque tokens before database lookup', async () => {
        const hash = await hashSessionToken('raw-session-token');

        expect(hash).not.toBe('raw-session-token');
        expect(hash).toHaveLength(64);
    });

    test('creates a stable provider identity and stores only the token hash', async () => {
        const { db, prepared, batches } = makeDatabase();

        const result = await createUserSession(db, profile, 1_000, () => 'raw-session-token');
        const tokenHash = await hashSessionToken('raw-session-token');

        expect(result.token).toBe('raw-session-token');
        expect(result.user.id).toBe('github:42');
        expect(toClientUser(result.user).id).toBe('github:42');
        expect(batches).toHaveLength(1);
        expect(prepared[0]?.sql).toContain('ON CONFLICT(provider, provider_user_id)');
        expect(prepared.some(call => call.values.includes('raw-session-token'))).toBe(false);
        expect(prepared.some(call => call.values.includes(tokenHash))).toBe(true);
    });

    test('returns the server-owned user for a valid unexpired session', async () => {
        const { db, prepared } = makeDatabase({
            id: 'github:42',
            provider: 'github',
            provider_user_id: '42',
            display_name: 'Ada',
            email: 'ada@example.com',
            avatar_url: 'https://example.com/ada.png',
            github_username: 'ada',
            email_verified: 1,
        });

        const user = await getSessionUser(db, 'raw-session-token', 2_000);

        expect(user?.id).toBe('github:42');
        expect(user?.emailVerified).toBe(true);
        expect(prepared[0]?.values[0]).toBe(await hashSessionToken('raw-session-token'));
        expect(prepared[0]?.values[1]).toBe(2_000);
    });

    test('uses an HTTP-only cookie and only marks HTTPS requests secure', () => {
        expect(SESSION_COOKIE_NAME).toBe('aat_session');
        expect(sessionCookieOptions(new URL('https://ai.dosa.dev'))).toMatchObject({
            httpOnly: true,
            sameSite: 'lax',
            secure: true,
            path: '/',
        });
        expect(sessionCookieOptions(new URL('http://localhost:4321')).secure).toBe(false);
    });
});
