import { describe, expect, test } from 'bun:test';
import { hasLocalDevOrigin, isLocalDevRequest } from './dev-auth';

describe('development authentication gate', () => {
    test('allows loopback hosts only in development mode', () => {
        expect(isLocalDevRequest(new Request('http://localhost:4321/api/auth/dev'), true)).toBe(true);
        expect(isLocalDevRequest(new Request('http://127.0.0.1:4321/api/auth/dev'), true)).toBe(true);
        expect(isLocalDevRequest(new Request('http://[::1]:4321/api/auth/dev'), true)).toBe(true);
    });

    test('rejects production mode and non-loopback hosts', () => {
        expect(isLocalDevRequest(new Request('http://localhost:4321/api/auth/dev'), false)).toBe(false);
        expect(isLocalDevRequest(new Request('https://ai.dosa.dev/api/auth/dev'), true)).toBe(false);
        expect(isLocalDevRequest(new Request('https://preview.example/api/auth/dev'), true)).toBe(false);
    });

    test('allows loopback preview origins while rejecting external origins', () => {
        expect(hasLocalDevOrigin(new Request('http://localhost:4321/api/auth/dev', {
            method: 'POST',
            headers: { Origin: 'http://127.0.0.1:33781' },
        }))).toBe(true);
        expect(hasLocalDevOrigin(new Request('http://localhost:4321/api/auth/dev', {
            method: 'POST',
            headers: { Origin: 'https://attacker.example' },
        }))).toBe(false);
        expect(hasLocalDevOrigin(new Request('http://localhost:4321/api/auth/dev', {
            method: 'POST',
        }))).toBe(false);
    });
});
