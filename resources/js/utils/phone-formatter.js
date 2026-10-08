/**
 * /resources/js/utils/phone-formatter.js
 * 
 * Auto-formats phone numbers (US/Canada style) as user types.
 */

export function attachPhoneFormatter() {
    document.addEventListener('input', (e) => {
        const input = e.target;
        if (!input.matches('input[name="phone"]')) return;

        let digits = input.value.replace(/\D/g, '');
        if (digits.length > 10) digits = digits.substring(0, 10);

        let formatted = digits;
        if (digits.length > 6) formatted = `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
        else if (digits.length > 3) formatted = `(${digits.substring(0, 3)}) ${digits.substring(3)}`;
        else if (digits.length > 0) formatted = `(${digits}`;
        input.value = formatted;
    });
}
