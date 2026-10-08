// /resources/js/pages/profile-page.js

import { initProfileModal } from '../modals/profile-modal.js';
import { initProfileAvatar } from '../utils/profile/profile-avatar.js';
import { AnimationEngine } from '../utils/animations';

/**
 * Initialize the Profile page JS with CatScript animations
 */
export function init() {
    // 1. Fire AOS to animate the new profile cards and hero section
    AnimationEngine.refresh();

    // 2. Initialize the modal bridge for "Edit Profile"
    initProfileModal();

    // 3. Initialize avatar upload/delete logic (preserved functional integrity)
    initProfileAvatar();
}
