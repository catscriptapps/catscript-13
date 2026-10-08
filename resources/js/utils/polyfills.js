// /resources/js/utils/polyfills.js
/**
 * Global Polyfills for modern browser features used in the application.
 */

// Polyfill for crypto.randomUUID()
if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    
    // Fallback UUID v4 generation function
    const generateFallbackUUID = () => {
        let d = new Date().getTime(); // Timestamp
        // High-precision timing if available
        let d2 = ((performance && performance.now && (performance.now() * 1000)) || 0); 
        
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            let r = Math.random() * 16;
            if (d > 0) {
                r = (d + r) % 16 | 0;
                d = Math.floor(d / 16);
            } else {
                r = (d2 + r) % 16 | 0;
                d2 = Math.floor(d2 / 16);
            }
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    };

    // Ensure crypto object exists and attach the fallback function
    if (typeof crypto === 'undefined') {
        window.crypto = {};
    }
    crypto.randomUUID = generateFallbackUUID;
}

// NOTE: This file does not need to export anything. It runs its code on import, 
// modifying the global window/crypto object.