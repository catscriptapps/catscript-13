// /resources/js/api/user-types-api.js

/**
 * Fetches the account-type/role list (Admin, Landlord, Tenant, Property
 * Manager, Real Estate Agent, Contractor, Mortgage Broker, User) for the
 * user create/edit form's role picker.
 */
export async function fetchUserTypes() {
    const baseUrl = window.APP_CONFIG?.baseUrl || '/';
    const url = `${baseUrl}api/user-types`;

    try {
        const res = await fetch(url);
        const json = await res.json();

        return json.success ? json.data.map(t => ({
            id: t.user_type_id,
            name: t.user_type,
        })) : [];
    } catch (error) {
        console.error('Fetch User Types Error:', error);
        return [];
    }
}
