// /resources/js/utils/animations.js

import AOS from 'aos';
import 'aos/dist/aos.css';

let isInitialized = false;

export const AnimationEngine = {
    init() {
        if (isInitialized) return;
        
        AOS.init({
            duration: 1000,
            once: true,
            mirror: false,
            offset: 50, // Reduced offset for mobile/tablet sensitivity
            easing: 'ease-out-back',
            
            // USE A FUNCTION: This is evaluated every time AOS tries to run
            disable: function() {
                return window.innerWidth < 1024; // Disabling for both phone & tablet for safety
            },
            
            // Prevent AOS from adding classes until the DOM is fully ready
            startEvent: 'DOMContentLoaded', 
        });
        
        isInitialized = true;
    },

    refresh() {
        // Force a re-calculation of the window width before refreshing
        if (window.innerWidth < 1024) {
            // If we are on mobile, manually remove AOS classes just in case 
            // they were injected before the disable check finished
            const aosElements = document.querySelectorAll('[data-aos]');
            aosElements.forEach(el => {
                el.removeAttribute('data-aos');
                el.style.opacity = '1';
                el.style.transform = 'none';
                el.style.visibility = 'visible';
            });
            return; 
        }

        if (!isInitialized) {
            this.init();
        }

        setTimeout(() => {
            AOS.refreshHard(); // Hard refresh is better for dynamic page loads
        }, 100); 
    }
};