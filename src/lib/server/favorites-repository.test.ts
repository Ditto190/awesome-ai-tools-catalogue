import { describe, expect, test } from 'bun:test';
import type { Database } from './db';
import {
    addFavorite,
    listFavorites,
    removeFavorite,
} from './favorites-repository';

function makeDatabase(result: unknown, firstResult: unknown = result) {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
        prepare(sql: string) {
            return {
                bind(...values: unknown[]) {
                    calls.push({ sql, values });
                    return {
                        all: async () => result,
                        first: async () => firstResult,
                        run: async () => result,
                    };
                },
            };
        },
    } as unknown as Database;
    return { db, calls };
}

describe('favorites repository', () => {
    test('lists favorites newest first using database column names', async () => {
        const { db, calls } = makeDatabase({
            results: [
                { tool_slug: 'cursor', created_at: 20 },
                { tool_slug: 'claude-code', created_at: 10 },
            ],
        });

        expect(await listFavorites(db, 'google:123')).toEqual([
            { slug: 'cursor', createdAt: 20 },
            { slug: 'claude-code', createdAt: 10 },
        ]);
        expect(calls[0]?.sql).toContain('ORDER BY created_at DESC');
        expect(calls[0]?.values).toEqual(['google:123']);
    });

    test('returns the persisted timestamp when adding a favorite', async () => {
        const { db, calls } = makeDatabase({
            results: [{ tool_slug: 'cursor', created_at: 30 }],
            meta: { changes: 1 },
        });

        expect(await addFavorite(db, 'github:456', 'cursor', 30)).toEqual({
            favorite: { slug: 'cursor', createdAt: 30 },
            created: true,
        });
        expect(calls[0]?.sql).toContain('RETURNING tool_slug, created_at');
        expect(calls[0]?.values).toEqual(['github:456', 'cursor', 30]);
    });

    test('returns the original timestamp when the favorite already exists', async () => {
        const { db, calls } = makeDatabase(
            { results: [], meta: { changes: 0 } },
            { tool_slug: 'cursor', created_at: 10 },
        );

        expect(await addFavorite(db, 'github:456', 'cursor', 30)).toEqual({
            favorite: { slug: 'cursor', createdAt: 10 },
            created: false,
        });
        expect(calls[1]?.sql).toContain('WHERE user_id = ? AND tool_slug = ?');
        expect(calls[1]?.values).toEqual(['github:456', 'cursor']);
    });

    test('removes only the current user favorite', async () => {
        const { db, calls } = makeDatabase({ meta: { changes: 1 } });

        expect(await removeFavorite(db, 'github:456', 'cursor')).toBe(true);
        expect(calls[0]?.sql).toContain('user_id = ?');
        expect(calls[0]?.values).toEqual(['github:456', 'cursor']);
    });
});
