import { EVENTS } from '../src/lib/analytics-events.js';
import { analytics } from './analytics-client.js';
import { authAttribution } from './auth-attribution.js';

function currentToolSlug() {
    const match = window.location.pathname.match(/^\/tools\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : '';
}

function placement(anchor) {
    if (anchor.closest('[data-compare-row]')) return 'tool_card';
    if (window.location.pathname.startsWith('/compare')) return 'comparison';
    if (window.location.pathname.startsWith('/category')) return 'category';
    if (window.location.pathname.startsWith('/tools/')) return 'tool_detail';
    return 'unknown';
}

document.addEventListener('click', event => {
    const authLink = event.target.closest?.('a[data-auth-trigger]');
    if (authLink) {
        event.preventDefault();
        authAttribution.open(authLink.dataset.authTrigger);
        return;
    }

    const anchor = event.target.closest?.('a[href^="http"]');
    if (!anchor) return;

    let url;
    try {
        url = new URL(anchor.href);
    } catch {
        return;
    }
    if (url.hostname === window.location.hostname) return;

    const row = anchor.closest('[data-compare-row]');
    const subject = row?.dataset.slug || currentToolSlug();
    if (!subject) return;
    analytics.track(EVENTS.OUTBOUND_CLICK, {
        trigger: placement(anchor),
        subject,
    });
});
