import { fetchRegions } from "../api/regions-api.js";

/**
 * Enables dynamic loading of regions when the country select changes.
 */
export function enableDynamicRegionLoading(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    // 🍊 Support both camelCase and snake_case to work with different form versions
    const countrySelect = form.querySelector('select[name="countryId"]') || form.querySelector('select[name="country_id"]');
    const regionSelect = form.querySelector('select[name="regionId"]') || form.querySelector('select[name="region_id"]');

    if (!countrySelect || !regionSelect) return;

    // We add 'event' (e) as a parameter here to catch custom data
    countrySelect.addEventListener('change', async (e) => {
        const countryId = countrySelect.value;

        // Grab the pre-selected ID if it was passed via CustomEvent
        const preSelectedId = e.detail?.preSelectedRegionId;

        // Only wipe the city on a genuine user-driven country switch — not
        // on the synthetic dispatch used to pre-load regions when an edit
        // modal first opens (that one always carries preSelectedRegionId),
        // which should leave the already-saved city alone.
        if (!preSelectedId) {
            const cityInput = form.querySelector('input[name="city"]');
            if (cityInput) cityInput.value = '';
        }

        if (!countryId) {
            regionSelect.innerHTML = '<option value="">Select Region</option>';
            return;
        }

        regionSelect.innerHTML = `<option value="">Loading...</option>`;
        regionSelect.disabled = true;

        try {
            const regions = await fetchRegions(countryId);

            // Build the options
            const optionsHtml = regions.map(r => {
                // Check if this region matches the one we want to auto-select
                const isSelected = preSelectedId && String(r.id) === String(preSelectedId);
                return `<option value="${r.id}" ${isSelected ? 'selected' : ''}>${r.name}</option>`;
            }).join('');

            regionSelect.innerHTML = `
                <option value="">Select Region</option>
                ${optionsHtml}
            `;
        } catch (error) {
            console.error('Failed to reload regions:', error);
            regionSelect.innerHTML = `<option value="">Error loading regions</option>`;
        } finally {
            regionSelect.disabled = false;
        }
    });
}