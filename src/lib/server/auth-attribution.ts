import type { AstroCookies } from 'astro';
import { sanitizeAuthTrigger } from '../analytics-events.js';

export const AUTH_TRIGGER_COOKIE_NAME = 'aat_auth_trigger';

export function getAuthTrigger(cookies: AstroCookies): string {
    return sanitizeAuthTrigger(cookies.get(AUTH_TRIGGER_COOKIE_NAME)?.value);
}
