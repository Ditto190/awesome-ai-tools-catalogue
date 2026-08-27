import { createFavoritesStore } from './favorites-store.js';

const store = createFavoritesStore();
let initialized = false;
let activeUserId = null;
let syncGeneration = 0;
let context = {
    isAuthenticated: () => false,
    onSignIn: () => {},
    onUnauthorized: () => {},
};

function buttonLabel(button, active, authenticated) {
    const toolName = button.dataset.toolName || 'tool';
    if (!authenticated) return `Sign in to save ${toolName}`;
    return active ? `Remove ${toolName} from favorites` : `Save ${toolName} to favorites`;
}

export function refreshFavoriteButtons(root = document) {
    const authenticated = context.isAuthenticated();
    root.querySelectorAll('.favorite-btn[data-tool-slug]').forEach(button => {
        const active = authenticated && store.has(button.dataset.toolSlug);
        const label = buttonLabel(button, active, authenticated);
        button.classList.toggle('favorited', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
        button.setAttribute('aria-label', label);
        button.title = label;
        const icon = button.querySelector('.favorite-icon');
        if (icon) icon.setAttribute('fill', active ? 'currentColor' : 'none');
        const text = button.querySelector('[data-favorite-label]');
        if (text) text.textContent = active ? 'Saved' : 'Favorite';
    });
}

export function initFavorites(options = {}) {
    context = { ...context, ...options };
    if (initialized) {
        refreshFavoriteButtons();
        return;
    }

    initialized = true;
    store.subscribe(() => refreshFavoriteButtons());
    document.addEventListener('click', async event => {
        const button = event.target.closest?.('.favorite-btn[data-tool-slug]');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();

        if (!context.isAuthenticated()) {
            context.onSignIn();
            return;
        }

        button.disabled = true;
        try {
            await store.toggle(button.dataset.toolSlug);
        } catch (error) {
            if (error?.status === 401) await context.onUnauthorized();
            button.dataset.tip = 'Could not update favorite. Try again.';
            setTimeout(() => delete button.dataset.tip, 2500);
        } finally {
            button.disabled = false;
        }
    });
    refreshFavoriteButtons();
}

export async function loadFavorites() {
    const result = await store.load();
    refreshFavoriteButtons();
    return result;
}

export async function syncFavorites(user) {
    const userId = user?.id ?? null;
    const sync = ++syncGeneration;
    if (activeUserId !== userId) {
        activeUserId = userId;
        store.clear();
    }
    if (!userId) {
        refreshFavoriteButtons();
        return { authenticated: false, favorites: [], stale: false };
    }

    const result = await store.load();
    if (sync !== syncGeneration || activeUserId !== userId || result.stale) {
        return { ...result, favorites: store.records(), stale: true };
    }
    refreshFavoriteButtons();
    return result;
}

export function clearFavorites() {
    activeUserId = null;
    syncGeneration += 1;
    store.clear();
    refreshFavoriteButtons();
}

export function getFavoriteRecords() {
    return store.records();
}

export function subscribeFavorites(listener) {
    return store.subscribe(listener);
}
