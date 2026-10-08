// /resources/js/api/countries-api.js

export async function fetchCountries() {
    const baseUrl = window.APP_CONFIG?.baseUrl || '/';
    const url = `${baseUrl}api/countries`;

    const res = await fetch(url);
    const json = await res.json();

    // Mapping based on App\Models\Country (legacy table): country_id, country
    return json.success ? json.data.map(c => ({
        id: c.country_id,
        name: c.country,
    })) : [];
}