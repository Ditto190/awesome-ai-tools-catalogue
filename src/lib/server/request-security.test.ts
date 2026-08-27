import { describe, expect, test } from 'bun:test';
import { isAllowedMutationRequest, isSameOriginRequest } from './request-security';

describe('request origin validation', () => {
    test('accepts an exact same-origin mutation', () => {
        const request = new Request('https://ai.dosa.dev/api/favorites/cursor', {
            method: 'PUT',
            headers: { Origin: 'https://ai.dosa.dev' },
        });

        expect(isSameOriginRequest(request)).toBe(true);
    });

    test('rejects missing and cross-origin origins', () => {
        expect(isSameOriginRequest(new Request('https://ai.dosa.dev/api/favorites/cursor'))).toBe(false);
        expect(isSameOriginRequest(new Request('https://ai.dosa.dev/api/favorites/cursor', {
            headers: { Origin: 'https://attacker.example' },
        }))).toBe(false);
    });

    test('accepts a loopback preview proxy only in development', () => {
        const request = new Request('http://localhost:4321/api/favorites/cursor', {
            method: 'PUT',
            headers: { Origin: 'http://127.0.0.1:33781' },
        });

        expect(isAllowedMutationRequest(request, true)).toBe(true);
        expect(isAllowedMutationRequest(request, false)).toBe(false);
        expect(isAllowedMutationRequest(new Request('http://localhost:4321/api/favorites/cursor', {
            method: 'PUT',
            headers: { Origin: 'https://attacker.example' },
        }), true)).toBe(false);
    });
});
