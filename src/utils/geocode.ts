import { supabase } from '../services/supabase.client';

export interface LocationData {
  lat: number;
  lng: number;
  city: string;
  state: string;
}

export class GeocodeService {
  /**
   * Retrieves latitude and longitude for a given zip code.
   * Checks the Supabase geocode_cache first. If missing, calls Nominatim,
   * caches the result, and returns it.
   */
  static async getCoordinatesForZip(zip: string): Promise<LocationData | null> {
    // 1. Check Cache
    const { data: cacheData, error: cacheError } = await supabase
      .from('geocode_cache')
      .select('lat, lng, city, state')
      .eq('zip_code', zip)
      .single();

    if (cacheData && !cacheError && cacheData.city && cacheData.state) {
      return {
        lat: cacheData.lat,
        lng: cacheData.lng,
        city: cacheData.city,
        state: cacheData.state,
      };
    }

    // 2. Fetch from External Service (Nominatim)
    try {
      // Note: Nominatim requires a descriptive User-Agent
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=USA&format=json&limit=1&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'LookForNeighbourhoodAPI/1.0',
          },
        },
      );

      if (!response.ok) {
        console.error(
          `[Nominatim] Failed to fetch coords for ${zip}: ${response.statusText}`,
        );
        return null;
      }

      const results = await response.json();

      if (!results || results.length === 0) {
        console.warn(`[Nominatim] No coordinates found for zip: ${zip}`);
        return null;
      }

      const match = results[0];
      const lat = parseFloat(match.lat);
      const lng = parseFloat(match.lon);

      // 3. Extract City/State from structured address
      const addr = match.address || {};
      const city =
        addr.city || addr.town || addr.village || addr.hamlet || 'Unknown City';
      const state = addr.state || 'Unknown State';

      // 3. Save to Cache
      const { error: insertError } = await supabase
        .from('geocode_cache')
        .upsert(
          {
            zip_code: zip,
            lat,
            lng,
            city,
            state,
          },
          { onConflict: 'zip_code' },
        );

      if (insertError) {
        console.error(
          `[Geocode Cache] Failed to save location for ${zip}`,
          insertError,
        );
      }

      return { lat, lng, city, state };
    } catch (err: any) {
      console.error(
        `[GeocodeService] Error determining coordinates for ${zip}`,
        err,
      );
      return null;
    }
  }
}
