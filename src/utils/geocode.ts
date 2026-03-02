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
        `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=USA&format=json&limit=1`,
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

      // Nominatim display_name format usually: "City, County, State, ZIP, Country"
      // e.g. "Milwaukee, Milwaukee County, Wisconsin, 53202, United States"
      const addressParts = match.display_name
        .split(',')
        .map((p: string) => p.trim());

      // A naive fallback - usually the first part is the city, and second to last is ZIP so third to last is State.
      // E.g. addressParts[0] = City, addressParts[addressParts.length - 3] = State
      const city = addressParts[0] || 'Unknown City';
      const state =
        addressParts.length >= 3
          ? addressParts[addressParts.length - 3]
          : 'Unknown State';

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
