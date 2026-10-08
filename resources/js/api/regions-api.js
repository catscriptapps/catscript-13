// /resources/js/api/regions-api.js

/**
 * Fetches regions filtered by country
 * Maps API response to standardized JS objects based on Region.php model.
 */
export async function fetchRegions(countryId = 1) {
    const baseUrl = window.APP_CONFIG?.baseUrl || '/';
    const url = `${baseUrl}api/regions?country_id=${countryId}`;

    try {
        const res = await fetch(url);
        const json = await res.json();

        // Mapping based on App\Models\Region (legacy table): region_id, region, country_id
        return json.success ? json.data.map(r => ({
            id: r.region_id,
            name: r.region     // The column name is 'region'
        })) : [];

    } catch (error) {
        console.error('Fetch Regions Error:', error);
        return [];
    }
}