/**
 * File: /resources/js/ui/tooltip.js
 * Purpose: Initializes and manages tooltip behavior for elements with the `data-tooltip` attribute.
 * 
 * Description:
 * - Dynamically creates a single tooltip element and appends it to the DOM.
 * - Attaches hover and movement listeners to all elements with `data-tooltip`.
 * - Positions the tooltip above the hovered element and updates its location on mousemove.
 * - Hides the tooltip with a short delay on mouseleave to allow smooth transitions.
 * 
 * Usage:
 * - Call `initTooltips()` once after DOM is ready or after partial content loads.
 * - Ensure tooltip styling is defined in CSS for `.tooltip` and `.tooltip.show`.
 * 
 * Dependencies: None (vanilla JS)
 * Integration: Compatible with partial loading systems and reusable across views.
 */
export function initTooltips() {
  // Create a reusable tooltip element
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip'; // Assumes CSS handles base styling and visibility
  document.body.appendChild(tooltip); // Append to body so it's globally positioned

  let hideTimeout; // Used to delay hiding for smoother UX

  // Show tooltip when mouse enters a target element
  function showTooltip(e) {
    const el = e.currentTarget;
    const text = el.dataset.tooltip; // Get tooltip text from data-tooltip attribute
    if (!text) return; // Skip if no tooltip text is defined

    clearTimeout(hideTimeout); // Cancel any pending hide

    tooltip.textContent = text; // Set tooltip content
    tooltip.classList.add('show'); // Make tooltip visible (CSS should handle .show)

    // Position tooltip above the element, centered horizontally
    const rect = el.getBoundingClientRect();
    const top = rect.top - 12; // Offset above element
    const left = rect.left + rect.width / 2; // Center horizontally

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  // Hide tooltip after a short delay
  function hideTooltip() {
    hideTimeout = setTimeout(() => {
      tooltip.classList.remove('show'); // Remove visibility class
    }, 100); // Delay allows smoother transition and prevents flicker
  }

  // Reposition tooltip as mouse moves within the element
  function moveTooltip(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const top = rect.top - 12;
    const left = rect.left + rect.width / 2;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  // Attach tooltip behavior to all elements with a data-tooltip attribute
  document.querySelectorAll('[data-tooltip]').forEach((el) => {
    el.addEventListener('mouseenter', showTooltip); // Show on hover
    el.addEventListener('mouseleave', hideTooltip); // Hide on exit
    el.addEventListener('mousemove', moveTooltip);  // Update position on move
  });
}
