import {
    createRemoteJWKSet,
    jwtVerify,
    type JWTPayload,
    type JWTVerifyGetKey,
} from 'jose';
import type { IdentityProfile } from './user-session';

const googleJwks = createRemoteJWKSet(
    new URL('https://www.googleapis.com/oauth2/v3/certs'),
);

export function normalizeGoogleIdentity(payload: JWTPayload): IdentityProfile {
    if (typeof payload.sub !== 'string' || typeof payload.name !== 'string') {
        throw new Error('Google credential is missing required identity claims');
    }

    return {
        provider: 'google',
        providerUserId: payload.sub,
        name: payload.name,
        email: typeof payload.email === 'string' ? payload.email : null,
        picture: typeof payload.picture === 'string' ? payload.picture : null,
        githubUsername: null,
        emailVerified: payload.email_verified === true,
    };
}

export async function verifyGoogleCredential(
    credential: string,
    clientId: string,
    key: CryptoKey | JWTVerifyGetKey = googleJwks,
): Promise<IdentityProfile> {
    const { payload } = await jwtVerify(credential, key, {
        audience: clientId,
        issuer: ['accounts.google.com', 'https://accounts.google.com'],
    });
    return normalizeGoogleIdentity(payload);
}
