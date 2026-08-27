import { env } from 'cloudflare:workers';
import type { Database } from './db';

function configuredValue(...values: unknown[]): string {
    for (const value of values) {
        if (typeof value === 'string' && value) return value;
    }
    return '';
}

export function getGoogleClientId(): string {
    return configuredValue(env.GOOGLE_CLIENT_ID, import.meta.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_ID);
}

export function getGitHubClientId(): string {
    return configuredValue(env.GITHUB_CLIENT_ID, import.meta.env.GITHUB_CLIENT_ID, process.env.GITHUB_CLIENT_ID);
}

export function getGitHubClientSecret(): string {
    return configuredValue(env.GITHUB_CLIENT_SECRET, import.meta.env.GITHUB_CLIENT_SECRET, process.env.GITHUB_CLIENT_SECRET);
}

export function requireDatabase(): Database {
    const db = env.DB;
    if (!db) throw new Error('D1 binding DB is not configured');
    return db;
}
