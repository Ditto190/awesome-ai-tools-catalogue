import { hasLocalDevOrigin, isLocalDevRequest } from './dev-auth';

export function isSameOriginRequest(request: Request): boolean {
    const origin = request.headers.get('Origin');
    if (!origin) return false;

    try {
        return new URL(origin).origin === new URL(request.url).origin;
    } catch {
        return false;
    }
}

export function isAllowedMutationRequest(request: Request, isDev: boolean): boolean {
    return isSameOriginRequest(request)
        || (isLocalDevRequest(request, isDev) && hasLocalDevOrigin(request));
}

export function jsonError(message: string, status: number): Response {
    return Response.json({ error: message }, {
        status,
        headers: { 'Cache-Control': 'no-store' },
    });
}
