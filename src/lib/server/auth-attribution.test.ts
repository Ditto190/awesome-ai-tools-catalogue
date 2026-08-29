import { describe, expect, test } from 'bun:test';
import { AUTH_TRIGGER_COOKIE_NAME, getAuthTrigger } from './auth-attribution';

describe('server auth attribution', () => {
    test('reads the shared trigger cookie', () => {
        const cookies = {
            get: (name: string) => name === AUTH_TRIGGER_COOKIE_NAME ? { value: 'zap_btn' } : undefined,
        };
        expect(getAuthTrigger(cookies as never)).toBe('zap_btn');
    });

    test('falls back to sidebar for invalid cookie values', () => {
        const cookies = { get: () => ({ value: 'first_run' }) };
        expect(getAuthTrigger(cookies as never)).toBe('sidebar');
    });
});
