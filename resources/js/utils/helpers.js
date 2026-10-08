// /resources/js/utils/helpers.js

/**
 * Triggers the dynamic loading of regions based on the user's default country.
 * * This function checks if the current form context matches the target form name 
 * (typically used for 'add' modes) and dispatches a CustomEvent to the country 
 * selector. This event carries the user's global default region ID, allowing 
 * the region-component to auto-select it once the async fetch completes.
 * * @param {string} idPrefix - The prefix used for element IDs (e.g., 'listing-add').
 * @param {HTMLFormElement} form - The form DOM element containing the selectors.
 * @param {string} formName - The specific form name/mode to trigger for (e.g., 'listing-add').
 * @returns {void}
 */
export function loadDefaultRegions(idPrefix, form, formName) {
    const countrySelect = form.querySelector(`select[name="countryId"]`);

    if (idPrefix === formName && countrySelect && countrySelect.value) {
        // We send a CustomEvent instead of a plain Event
        // This passes the user's default region ID safely to the loader
        const event = new CustomEvent('change', { 
            detail: { preSelectedRegionId: window.APP_CONFIG.userDefaults.region_id } 
        });
        countrySelect.dispatchEvent(event);
    }
}

/**
 * Renders a visual placeholder within a grid when no photos are available.
 * 
 * @param {HTMLElement} grid - The container element where the placeholder will be appended.
 * @returns {void}
 */
export function photosEmptyStatePlaceholder(grid){
    const emptyHtml = `
        <div class="empty-state-placeholder col-span-full py-8 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
            <p class="text-gray-400 text-xs italic">No photos found.</p>
        </div>`;
    grid.insertAdjacentHTML('beforeend', emptyHtml);
}

/**
 * Toggles the visibility and requirement status of the house type selection 
 * based on the chosen unit type.
 * 
 * @param {HTMLFormElement} form - The parent form element containing the unit type trigger.
 * @param {string} idPrefix - The prefix used to construct unique IDs for the house type container and select elements.
 */
export function unitTypeToggleHouseLogic(form, idPrefix){
    const unitTypeSelect = form.querySelector('.unit-type-trigger');
    const houseTypeContainer = document.getElementById(`${idPrefix}-house-type-container`);
    const houseTypeSelect = document.getElementById(`${idPrefix}-house-type`);
    
    if (unitTypeSelect && houseTypeContainer) {
        unitTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === '5') {
                // Show container and make selection mandatory
                houseTypeContainer.classList.remove('hidden');
                houseTypeSelect?.setAttribute('required', 'required');
            } else {
                // Hide container and remove mandatory requirement
                houseTypeContainer.classList.add('hidden');
                if (houseTypeSelect) {
                    houseTypeSelect.removeAttribute('required');
                    houseTypeSelect.value = ''; // Clear value so it's not sent accidentally
                }
            }
        });
    }
}

/**
 * Updates a specific media counter label with current count and global limit.
 * * @param {string} labelId - The DOM ID of the element to update (e.g., 'ad-pic-count').
 * @param {number} count   - The current number of uploaded files.
 * @returns {void}
 */
export function updateMediaCountLabel(labelId, count){
    const limit = window.APP_CONFIG.mediaLimit || 4;
    const countLabel = document.getElementById(labelId);
    if (countLabel) countLabel.textContent = `${count} / ${limit}`;
}

/**
 * Global Keyboard Listener: ESC Key Handler
 * Priority-based closing to prevent "cascade close" 💎
 * @param {Object} viewContentMapper - The controller/mapper instance containing the closeModal method.
 */
export function closeTriggerESC(viewContentMapper) {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // 1. Check if the Mentor/Factory Modal is open
            const isFactoryModalOpen = document.body.classList.contains('modal-open-priority');

            // 2. Check if Upload Modal is open (Checking for .hidden is safer for your legacy setup)
            const uploadModal = document.getElementById('upload-modal');
            const isUploadOpen = uploadModal && !uploadModal.classList.contains('hidden');

            // 3. Check if Image Preview Modal is open
            const previewModal = document.getElementById('image-preview-modal');
            const isPreviewOpen = previewModal && !previewModal.classList.contains('hidden');
            
            // 4. Check if Delete Confirmation is open
            const isConfirmOpen = !!document.querySelector('[data-confirm-overlay]');

            // DEBUG: Uncomment this if it fails again to see which one is returning true
            // console.log({ isFactoryModalOpen, isUploadOpen, isPreviewOpen, isConfirmOpen });

            // CRITICAL: If ANY of these are open, STOP. Do not close the viewContentMapper.
            if (isFactoryModalOpen || isUploadOpen || isPreviewOpen || isConfirmOpen) {
                // We stop here because a foreground element is active
                return;
            }

            // ONLY if the coast is completely clear, close the background view
            viewContentMapper.closeModal();
        }
    });
}