export function createSessionClient({ request = fetch } = {}) {
    async function readUser(response, operation) {
        if (!response.ok) throw new Error(`${operation} failed: ${response.status}`);
        const { user } = await response.json();
        return user;
    }

    async function get() {
        const response = await request('/api/auth/session', {
            headers: { 'Accept': 'application/json' },
        });
        if (response.status === 401) return null;
        return readUser(response, 'Session restore');
    }

    async function getConfig() {
        const response = await request('/api/auth/config', {
            headers: { 'Accept': 'application/json' },
        });
        if (!response.ok) throw new Error(`Auth configuration failed: ${response.status}`);
        const config = await response.json();
        return {
            googleClientId: typeof config.googleClientId === 'string' ? config.googleClientId : '',
        };
    }

    async function createGoogle(credential) {
        const response = await request('/api/auth/session', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ credential }),
        });
        return readUser(response, 'Google authentication');
    }

    async function createDev() {
        const response = await request('/api/auth/dev', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: '{}',
        });
        return readUser(response, 'Development login');
    }

    async function deleteSession() {
        const response = await request('/api/auth/session', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
            keepalive: true,
        });
        if (!response.ok) throw new Error(`Sign-out failed: ${response.status}`);
    }

    return { createDev, createGoogle, delete: deleteSession, get, getConfig };
}

export const sessionClient = createSessionClient();
