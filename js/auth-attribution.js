import { sanitizeAuthTrigger } from '../src/lib/analytics-events.js';

const PENDING_KEY = 'aat_auth_trigger_pending';
const ACTIVE_KEY = 'aat_auth_trigger_active';
const COOKIE_NAME = 'aat_auth_trigger';

export function createAuthAttribution({
    storage = globalThis.sessionStorage,
    documentRef = globalThis.document,
    locationRef = globalThis.location,
} = {}) {
    let active = '';

    function read(key) {
        try {
            return storage?.getItem(key) ?? '';
        } catch {
            return '';
        }
    }

    function write(key, value) {
        try {
            if (value) storage?.setItem(key, value);
            else storage?.removeItem(key);
        } catch {}
    }

    function setPending(trigger) {
        write(PENDING_KEY, sanitizeAuthTrigger(trigger));
    }

    function begin(fallback = 'sidebar') {
        active = sanitizeAuthTrigger(read(PENDING_KEY) || fallback);
        write(PENDING_KEY, '');
        write(ACTIVE_KEY, active);
        const secure = locationRef?.protocol === 'https:' ? '; Secure' : '';
        if (documentRef) {
            documentRef.cookie = `${COOKIE_NAME}=${encodeURIComponent(active)}; Max-Age=600; Path=/; SameSite=Lax${secure}`;
        }
        return active;
    }

    function current() {
        return sanitizeAuthTrigger(active || read(ACTIVE_KEY) || read(PENDING_KEY));
    }

    function clear() {
        active = '';
        write(PENDING_KEY, '');
        write(ACTIVE_KEY, '');
        const secure = locationRef?.protocol === 'https:' ? '; Secure' : '';
        if (documentRef) documentRef.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
    }

    function open(trigger) {
        setPending(trigger);
        const button = documentRef?.getElementById?.('signInTriggerBtn');
        const modal = documentRef?.getElementById?.('signInModal');
        if (button && modal) button.click();
        else if (locationRef) locationRef.href = '/?signin=1';
    }

    return { begin, clear, current, open, setPending };
}

export const authAttribution = createAuthAttribution();
