// /resources/js/utils/postal-formatter.js

/**
 * Formats Canadian postal codes into 'A1A 1A1' layout on blur.
 */
export function formatCanadaPostal(raw) {
    if (!raw) return '';
    const s = raw.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '');
    if (s.length <= 3) return s;
    return s.slice(0, 3) + ' ' + s.slice(3, 6);
}

/**
 * Attaches real-time rules and auto-formatting handlers to postal fields.
 */
export function attachPostalFormatter(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    const postalInput = form.querySelector('input[name="postalCode"]');
    if (!postalInput) return;

    // Capitalize and restrict length as they type
    postalInput.addEventListener('input', () => {
        let val = postalInput.value.toUpperCase().replace(/[^A-Z0-9\s]/g, '');
        if (val.replace(/\s/g, '').length > 6) {
            val = val.substring(0, 7);
        }
        postalInput.value = val;
    });

    // Structure cleanly on blur (e.g., l4n0r5 -> L4N 0R5)
    postalInput.addEventListener('blur', () => {
        postalInput.value = formatCanadaPostal(postalInput.value);
    });
}