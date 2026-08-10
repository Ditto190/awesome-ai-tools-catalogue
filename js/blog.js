/**
 * blog.js — client-side behavior for the blog pages.
 *
 * Loaded on both /blog (index) and /blog/[id] (article) pages.
 * Each initializer guards on its elements existing, so one file serves both.
 *
 * - initCopyButtons: copy-link + copy-for-AI buttons (article page)
 * - initTocScrollSpy: highlights the active heading in the right-side TOC
 * - initBlogSearch: client-side search + popular tag filters (index page)
 */

function copyText(text) {
    if (navigator.clipboard && window.isSecureContext !== false) {
        return navigator.clipboard.writeText(text);
    }
    // Fallback for non-secure contexts / older browsers
    return new Promise((resolve, reject) => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy') ? resolve() : reject(new Error('copy failed'));
        } catch (err) {
            reject(err);
        } finally {
            textarea.remove();
        }
    });
}

function flashLabel(button, text) {
    const label = button.querySelector('[data-label]');
    if (!label) return;
    const original = label.textContent;
    label.textContent = text;
    // `disabled` only exists on real buttons; the AI targets are anchors
    if (button instanceof HTMLButtonElement) button.disabled = true;
    setTimeout(() => {
        label.textContent = original;
        if (button instanceof HTMLButtonElement) button.disabled = false;
    }, 1500);
}

function initCopyButtons() {
    // AI deep links: <a> elements that open the chatbot in a new tab AND copy
    // the prompt to the clipboard as a fallback (some targets strip query params).
    // Navigation is intentionally NOT prevented.
    // Copy link: a plain <button> that only copies.
    const buttons = document.querySelectorAll('.ai-copy-btn, #copy-link-btn');
    if (!buttons.length) return;

    buttons.forEach((button) => {
        button.addEventListener('click', async () => {
            try {
                await copyText(button.dataset.copy || '');
                flashLabel(button, button.dataset.copiedLabel || 'Copied!');
            } catch {
                flashLabel(button, 'Failed');
            }
        });
    });
}

function initCopyLlm() {
    const button = document.getElementById('copy-llm-btn');
    const dataEl = document.getElementById('article-markdown');
    if (!button || !dataEl) return;

    button.addEventListener('click', async () => {
        let markdown = '';
        try {
            markdown = JSON.parse(dataEl.textContent || '{}').markdown || '';
        } catch {
            // fall through to failure label
        }
        try {
            if (!markdown) throw new Error('no markdown');
            await copyText(markdown);
            flashLabel(button, 'Copied!');
        } catch {
            flashLabel(button, 'Failed');
        }
    });
}

function initTocScrollSpy() {
    const tocLinks = document.querySelectorAll('[data-toc-link]');
    const articleBody = document.getElementById('article-body');
    if (!tocLinks.length || !articleBody || !('IntersectionObserver' in window)) return;

    const headings = articleBody.querySelectorAll('h2[id], h3[id]');
    if (!headings.length) return;

    let activeSlug = null;
    const setActive = (slug) => {
        if (slug === activeSlug) return;
        activeSlug = slug;
        tocLinks.forEach((link) => {
            const isActive = link.dataset.tocLink === slug;
            link.classList.toggle('text-white', isActive);
            link.classList.toggle('border-[#22d3ee]', isActive);
            link.classList.toggle('text-[#737373]', !isActive);
            link.classList.toggle('border-transparent', !isActive);
        });
    };

    const visible = new Map();
    const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            visible.set(entry.target.id, entry.isIntersecting);
        }
        // Activate the first heading currently visible, scanning in document order
        for (const heading of headings) {
            if (visible.get(heading.id)) {
                setActive(heading.id);
                return;
            }
        }
    }, { rootMargin: '0px 0px -70% 0px' });

    headings.forEach((heading) => observer.observe(heading));
}

function initBlogSearch() {
    const input = document.getElementById('blog-search-input');
    const searchBtn = document.getElementById('blog-search-btn');
    const dataEl = document.getElementById('blog-posts-data');
    const resultsWrap = document.getElementById('search-results');
    const resultsList = document.getElementById('search-results-list');
    const resultsSummary = document.getElementById('search-results-summary');
    const clearBtn = document.getElementById('search-clear');
    const defaultView = document.getElementById('blog-default-view');
    if (!input || !dataEl || !resultsWrap || !resultsList || !defaultView) return;

    let posts = [];
    try {
        posts = JSON.parse(dataEl.textContent || '[]');
    } catch {
        return;
    }

    const el = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    };

    const renderCard = (post) => {
        const card = el('article', 'bg-white/[0.02] border border-[#222] rounded-lg overflow-hidden hover:border-[#444] transition-all group');
        const link = el('a', 'flex flex-col md:flex-row h-full');
        link.href = post.url;

        const imgWrap = el('div', 'w-full md:w-[200px] h-[160px] md:h-auto shrink-0 relative overflow-hidden bg-[#111]');
        const img = document.createElement('img');
        img.src = post.image;
        img.alt = post.title;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.className = 'w-full h-full object-cover transition-transform duration-500 group-hover:scale-105';
        imgWrap.appendChild(img);

        const content = el('div', 'flex-1 p-6 flex flex-col justify-between');
        const top = el('div');
        const meta = el('div', 'flex items-center space-x-2 text-xs text-[#737373] mb-3 font-mono');
        if (post.featured) {
            meta.appendChild(el('span', 'text-[#f0d08f]', 'Featured'));
            meta.appendChild(el('span', '', '•'));
        }
        meta.appendChild(el('span', '', post.date));
        meta.appendChild(el('span', '', '•'));
        meta.appendChild(el('span', '', post.author));
        top.appendChild(meta);
        top.appendChild(el('h3', 'text-xl font-semibold text-white group-hover:text-[#22d3ee] transition-colors mb-2', post.title));
        top.appendChild(el('p', 'text-[#a3a3a3] text-[15px] leading-relaxed mb-4 line-clamp-2', post.description));
        content.appendChild(top);

        if (post.tags.length) {
            const tagRow = el('div', 'flex flex-wrap gap-2');
            post.tags.forEach((tag) => {
                tagRow.appendChild(el('span', 'inline-flex items-center px-2 py-0.5 rounded border border-[#333] text-xs font-mono bg-white/[0.03] text-[#a3a3a3]', tag));
            });
            content.appendChild(tagRow);
        }

        link.appendChild(imgWrap);
        link.appendChild(content);
        card.appendChild(link);
        return card;
    };

    const runSearch = () => {
        const query = input.value.trim().toLowerCase();
        if (!query) {
            resultsWrap.classList.add('hidden');
            defaultView.classList.remove('hidden');
            return;
        }
        const matches = posts.filter((post) =>
            (post.title || '').toLowerCase().includes(query) ||
            (post.description || '').toLowerCase().includes(query) ||
            (post.author || '').toLowerCase().includes(query) ||
            (Array.isArray(post.tags) ? post.tags : []).some((tag) => String(tag).toLowerCase().includes(query))
        );

        resultsList.replaceChildren(...matches.map(renderCard));
        if (resultsSummary) {
            resultsSummary.textContent = matches.length
                ? `${matches.length} result${matches.length === 1 ? '' : 's'} for "${input.value.trim()}"`
                : `No articles found for "${input.value.trim()}"`;
        }
        defaultView.classList.add('hidden');
        resultsWrap.classList.remove('hidden');
    };

    searchBtn?.addEventListener('click', runSearch);
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') runSearch();
    });
    input.addEventListener('input', () => {
        if (!input.value.trim()) runSearch();
    });

    document.querySelectorAll('.tag-filter').forEach((chip) => {
        chip.addEventListener('click', () => {
            input.value = chip.dataset.tag || '';
            runSearch();
        });
    });

    clearBtn?.addEventListener('click', () => {
        input.value = '';
        runSearch();
        input.focus();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initCopyButtons();
    initCopyLlm();
    initTocScrollSpy();
    initBlogSearch();
});
