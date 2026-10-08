export function cleanupModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.remove(); // remove modal from DOM
  });

  // Also clear any lingering modal overlays or backdrops
  document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
}
