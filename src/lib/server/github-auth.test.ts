import { describe, expect, test } from 'bun:test';
import { fetchGitHubIdentity, githubApiHeaders } from './github-auth';

describe('GitHub authentication', () => {
    test('includes the required application user agent', () => {
        const headers = githubApiHeaders('test-access-token');

        expect(headers['User-Agent']).toBe('ai.dosa.dev');
        expect(headers.Authorization).toBe('Bearer test-access-token');
        expect(headers.Accept).toBe('application/vnd.github+json');
        expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
    });

    test('exchanges a code and returns a normalized identity profile', async () => {
        const calls: Array<{ url: string; init?: RequestInit }> = [];
        const request = async (input: string | URL | Request, init?: RequestInit) => {
            const url = String(input);
            calls.push({ url, init });
            if (url.endsWith('/login/oauth/access_token')) {
                return Response.json({ access_token: 'github-token' });
            }
            if (url.endsWith('/user/emails')) {
                return Response.json([
                    { email: 'other@example.com', primary: false, verified: true },
                    { email: 'ada@example.com', primary: true, verified: true },
                ]);
            }
            return Response.json({
                id: 42,
                login: 'ada',
                name: null,
                email: null,
                avatar_url: 'https://example.com/ada.png',
            });
        };

        expect(await fetchGitHubIdentity('oauth-code', 'client-id', 'client-secret', request)).toEqual({
            provider: 'github',
            providerUserId: '42',
            name: 'ada',
            email: 'ada@example.com',
            picture: 'https://example.com/ada.png',
            githubUsername: 'ada',
            emailVerified: true,
        });
        expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
            client_id: 'client-id',
            client_secret: 'client-secret',
            code: 'oauth-code',
        });
        expect(calls.slice(1).every(call => (
            call.init?.headers as Record<string, string>
        ).Authorization === 'Bearer github-token')).toBe(true);
    });

    test('rejects a failed token exchange', async () => {
        const request = async () => Response.json({ error: 'bad_verification_code' }, { status: 401 });

        await expect(fetchGitHubIdentity('bad-code', 'client-id', 'client-secret', request)).rejects.toThrow(
            'Token exchange failed: 401',
        );
    });
});
