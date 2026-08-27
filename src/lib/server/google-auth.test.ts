import { generateKeyPair, SignJWT } from 'jose';
import { describe, expect, test } from 'bun:test';
import { verifyGoogleCredential } from './google-auth';

async function signGoogleToken(
    privateKey: CryptoKey,
    claims: Record<string, unknown> = {},
    audience = 'local-client',
) {
    return new SignJWT({ name: 'Ada', email: 'ada@example.com', email_verified: true, ...claims })
        .setProtectedHeader({ alg: 'RS256' })
        .setIssuer('https://accounts.google.com')
        .setAudience(audience)
        .setSubject('google-42')
        .setExpirationTime('1h')
        .sign(privateKey);
}

describe('Google credential verification', () => {
    test('normalizes a valid signed identity', async () => {
        const { publicKey, privateKey } = await generateKeyPair('RS256');
        const credential = await signGoogleToken(privateKey);

        expect(await verifyGoogleCredential(credential, 'local-client', publicKey)).toEqual({
            provider: 'google',
            providerUserId: 'google-42',
            name: 'Ada',
            email: 'ada@example.com',
            picture: null,
            githubUsername: null,
            emailVerified: true,
        });
    });

    test('rejects the wrong audience', async () => {
        const { publicKey, privateKey } = await generateKeyPair('RS256');
        const credential = await signGoogleToken(privateKey, {}, 'other-client');

        await expect(verifyGoogleCredential(credential, 'local-client', publicKey)).rejects.toThrow();
    });

    test('rejects missing required identity claims', async () => {
        const { publicKey, privateKey } = await generateKeyPair('RS256');
        const credential = await new SignJWT({ email: 'ada@example.com' })
            .setProtectedHeader({ alg: 'RS256' })
            .setIssuer('https://accounts.google.com')
            .setAudience('local-client')
            .setSubject('google-42')
            .setExpirationTime('1h')
            .sign(privateKey);

        await expect(verifyGoogleCredential(credential, 'local-client', publicKey)).rejects.toThrow(
            'Google credential is missing required identity claims',
        );
    });
});
