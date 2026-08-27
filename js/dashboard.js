import { bindAuthSession } from './auth-session-binding.js';
import { CollapsedSidebar } from './collapsed-sidebar.js';
import { initUiManager } from './modules/ui-manager.js';

document.addEventListener('DOMContentLoaded', async () => {
    initUiManager();

    new CollapsedSidebar('iconSidebar', {
        onExpand: () => document.getElementById('openSidebarDesktop')?.click(),
        onSearchClick: () => {
            window.location.href = '/';
        }
    });

    await bindAuthSession();
});
