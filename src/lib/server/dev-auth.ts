const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function isLocalDevRequest(request: Request, isDev: boolean): boolean {
    if (!isDev) return false;

    try {
        return loopbackHosts.has(new URL(request.url).hostname);
    } catch {
        return false;
    }
}

export function hasLocalDevOrigin(request: Request): boolean {
    const origin = request.headers.get('Origin');
    if (!origin) return false;

    try {
        return loopbackHosts.has(new URL(origin).hostname);
    } catch {
        return false;
    }
}
