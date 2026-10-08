import { loadPartial } from '../utils/spa-router.js';

/**
 * Global Header Search Module - "People-First" Edition 💎
 */
export function initHeaderSearch() {
    const trigger = document.getElementById('search-trigger');
    const modal = document.getElementById('search-modal');
    const input = document.getElementById('global-search-input');
    const resultsArea = document.getElementById('search-results');
    const closeBtn = document.getElementById('close-search');

    if (!trigger || !modal) return;

    let currentCategory = 'users';
    let debounceTimer;

    // Trigger listeners using the exported constants below
    trigger.addEventListener('click', openSearchModal);
    closeBtn.addEventListener('click', closeSearchModal);

    async function performSearch(query) {
        if (query.length < 2) {
            resultsArea.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                    <p class="text-xs font-bold uppercase tracking-widest italic">Keep typing...</p>
                </div>`;
            return;
        }

        resultsArea.style.opacity = '0.5';

        try {
            const baseUrl = window.APP_CONFIG.baseUrl;
            const response = await fetch(`${baseUrl}api/search?q=${encodeURIComponent(query)}&cat=${currentCategory}`);
            const data = await response.json();

            if (data.success) {
                resultsArea.innerHTML = data.html;
            } else {
                resultsArea.innerHTML = `<div class="p-8 text-center text-red-500 font-bold">${data.messages[0]}</div>`;
            }
        } catch (err) {
            console.error("Search Error:", err);
            resultsArea.innerHTML = `<div class="p-8 text-center text-gray-400 font-medium italic">Search service temporarily unavailable.</div>`;
        } finally {
            resultsArea.style.opacity = '1';
        }
    }

    input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        debounceTimer = setTimeout(() => performSearch(query), 300);
    });

    window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openSearchModal(); }
        if (e.key === 'Escape') closeSearchModal();
    });

    modal.addEventListener('click', (e) => {
        if (e.target.id === 'search-modal') closeSearchModal();
    });

    // 3. Card Action Handling - Targeting the Contact Button specifically
    resultsArea.addEventListener('click', (e) => {
        const contactBtn = e.target.closest('.view-mentor-trigger');

        if (contactBtn) {
            const encodedId = contactBtn.getAttribute('data-id');
            closeSearchModal();

            if (encodedId) {
                // Save the ID to session storage (better than local as it clears when the tab closes)
                sessionStorage.setItem('pending_chat_id', encodedId);

                const baseUrl = window.APP_CONFIG?.baseUrl || '/';
                const chatUrl = `${baseUrl}chats`;
                loadPartial(chatUrl);
            }
        }
    });
}

/**
 * 🍊 Exported Modal Controls for External Triggers (like New Chat button)
 */
export const openSearchModal = () => {
    const modal = document.getElementById('search-modal');
    const input = document.getElementById('global-search-input');

    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        if (input) setTimeout(() => input.focus(), 50);
    }
};

export const closeSearchModal = () => {
    const modal = document.getElementById('search-modal');
    const input = document.getElementById('global-search-input');
    const resultsArea = document.getElementById('search-results');

    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        if (input) input.value = '';
        if (resultsArea) {
            resultsArea.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                    <p class="text-xs font-bold uppercase tracking-widest italic">Type a name to begin...</p>
                </div>`;
        }
    }
};