import type { AstroCookies } from 'astro';
import type { Database } from './db';
import {
    getSessionUser,
    SESSION_COOKIE_NAME,
    type SessionUser,
} from './user-session';

export async function getCookieSessionUser(
    cookies: AstroCookies,
    db: Database,
): Promise<SessionUser | null> {
    const token = cookies.get(SESSION_COOKIE_NAME)?.value ?? '';
    return getSessionUser(db, token);
}

export function toClientUser(user: SessionUser) {
    return {
        provider: user.provider,
        id: user.id,
        name: user.name,
        email: user.email,
        picture: user.picture,
        githubUsername: user.githubUsername,
        emailVerified: user.emailVerified,
    };
}
