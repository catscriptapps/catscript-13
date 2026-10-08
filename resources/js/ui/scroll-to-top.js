/**
 * /resources/js/ui/scroll-to-top.js
 * Initializes and manages the scroll-to-top button functionality.
 */

export function setupScrollToTop() {
    const scrollBtn = document.getElementById('scroll-top');
    const mainContent = document.getElementById('main-content'); // Assuming this is the main scrollable area

    if (scrollBtn && mainContent) {
        const handleScroll = e => {
            // Determine scroll position based on which element is scrolling
            const scrollTopPosition = (e.target === document || e.target === window)
                ? window.scrollY
                : mainContent.scrollTop;

            const visible = scrollTopPosition > 200;
            scrollBtn.style.opacity = visible ? '1' : '0';
            scrollBtn.style.pointerEvents = visible ? 'auto' : 'none';
            scrollBtn.style.display = visible ? 'flex' : 'none';
            // The chat bubble moves up to sit above this button while it shows (app.css)
            document.body.classList.toggle('scroll-top-visible', visible);
        };

        // Attach listeners
        window.addEventListener('scroll', handleScroll);
        mainContent.addEventListener('scroll', handleScroll);

        // Click handler
        scrollBtn.addEventListener('click', () => {
            // Check if main content is scrolled or if the window is scrolled
            if (mainContent.scrollTop > 0) mainContent.scrollTo({ top: 0, behavior: 'smooth' });
            else window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // Initial check
        handleScroll({ target: mainContent });
    }
}