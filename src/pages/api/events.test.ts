import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';

const points: Array<{ indexes: string[]; blobs: string[] }> = [];
mock.module('cloudflare:workers', () => ({
    env: {
        DB: {},
        ANALYTICS: { writeDataPoint: (point: { indexes: string[]; blobs: string[] }) => points.push(point) },
    },
}));

const { POST } = await import(`./events.ts?test=${Date.now()}`);

afterAll(() => mock.restore());
beforeEach(() => points.splice(0));

const cookies = { get: () => undefined };

function request(events: unknown[], origin = 'https://ai.dosa.dev') {
    return new Request('https://ai.dosa.dev/api/events', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
    });
}

describe('POST /api/events', () => {
    test('rejects cross-origin submissions', async () => {
        const response = await POST({ request: request([], 'https://example.com'), cookies } as never);
        expect(response.status).toBe(403);
    });

    test('accepts client events while dropping server-owned event names', async () => {
        const response = await POST({
            request: request([
                { event: 'signin_completed', userId: 'attacker', subject: 'ignored' },
                { event: 'gate_blocked', trigger: 'zap_btn', subject: 'cursor' },
                { event: 'not_real' },
            ]),
            cookies,
        } as never);

        expect(response.status).toBe(204);
        expect(points).toHaveLength(1);
        expect(points[0]!.indexes).toEqual(['gate_blocked']);
        expect(points[0]!.blobs[2]).toBe('');
        expect(points[0]!.blobs[4]).toBe('cursor');
    });

    test('caps a batch at twenty events and validates subjects', async () => {
        const events = Array.from({ length: 25 }, () => ({
            event: 'outbound_click',
            subject: 'cursor',
        }));
        const response = await POST({ request: request(events), cookies } as never);

        expect(response.status).toBe(204);
        expect(points).toHaveLength(20);
        expect(points[0]!.blobs[4]).toBe('cursor');
    });

    test('does not persist arbitrary subject text', async () => {
        const response = await POST({
            request: request([{ event: 'outbound_click', subject: 'person@example.com' }]),
            cookies,
        } as never);
        expect(response.status).toBe(204);
        expect(points[0]!.blobs[4]).toBe('');
    });

    test('returns 204 for an empty batch', async () => {
        const response = await POST({ request: request([]), cookies } as never);
        expect(response.status).toBe(204);
        expect(points).toHaveLength(0);
    });
});
