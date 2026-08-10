import { describe, it, expect } from 'bun:test';
import { maxLastUpdated, getLatestUpdate, formatDate } from '../src/lib/tools.ts';

describe('maxLastUpdated', () => {
    it('returns null for empty/missing input', () => {
        expect(maxLastUpdated([])).toBeNull();
        expect(maxLastUpdated([undefined, null, ''])).toBeNull();
    });

    it('picks the latest valid date', () => {
        expect(maxLastUpdated(['2026-01-05', '2026-08-09', '2026-03-14'])).toBe('2026-08-09');
    });

    it('compares by parsed time, not lexicographic order', () => {
        // Lexicographic sort would wrongly prefer '2026-8-1' over '2026-08-01';
        // both parse to the same time, so the first max wins deterministically.
        expect(maxLastUpdated(['2026-8-1', '2025-12-31'])).toBe('2026-8-1');
        expect(maxLastUpdated(['2026-08-01T10:00:00Z', '2026-08-01T09:00:00Z'])).toBe('2026-08-01T10:00:00Z');
    });

    it('skips unparseable dates', () => {
        expect(maxLastUpdated(['not-a-date', '2026-02-01'])).toBe('2026-02-01');
        expect(maxLastUpdated(['not-a-date'])).toBeNull();
    });
});

describe('getLatestUpdate', () => {
    it('reads enriched lastUpdated across real tools and returns a valid date', () => {
        const latest = getLatestUpdate();
        expect(latest).not.toBeNull();
        expect(isNaN(new Date(latest).getTime())).toBe(false);
    });
});

describe('formatDate', () => {
    it('formats ISO dates for display', () => {
        expect(formatDate('2026-08-09')).toBe('Aug 9, 2026');
    });

    it('renders in UTC so date-only strings never shift a day behind', () => {
        // 2026-08-09T00:30:00Z is still Aug 8 in US timezones without timeZone: 'UTC'
        expect(formatDate('2026-08-09T00:30:00Z')).toBe('Aug 9, 2026');
    });

    it('returns empty string for missing input and raw string for unparseable input', () => {
        expect(formatDate(undefined)).toBe('');
        expect(formatDate(null)).toBe('');
        expect(formatDate('garbage')).toBe('garbage');
    });
});
