import { supabase } from '../services/supabase.client';

export interface Coordinates {
  lat: number;
  lng: number;
}

export class GeocodeService {
  /**
   * Retrieves latitude and longitude for a given zip code.
   * Checks the Supabase geocode_cache first. If missing, calls Nominatim,
   * caches the result, and returns it.
   */
  static async getCoordinatesForZip(zip: string): Promise<Coordinates | null> {
    // 1. Check Cache
    const { data: cacheData, error: cacheError } = await supabase
      .from('geocode_cache')
      .select('lat, lng')
      .eq('zip_code', zip)
      .single();

    if (cacheData && !cacheError) {
      return { lat: cacheData.lat, lng: cacheData.lng };
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

      const lat = parseFloat(results[0].lat);
      const lng = parseFloat(results[0].lon);

      // 3. Save to Cache
      const { error: insertError } = await supabase
        .from('geocode_cache')
        .insert({
          zip_code: zip,
          lat,
          lng,
        });

      if (insertError) {
        console.error(
          `[Geocode Cache] Failed to save coords for ${zip}`,
          insertError,
        );
      }

      return { lat, lng };
    } catch (err: any) {
      console.error(
        `[GeocodeService] Error determining coordinates for ${zip}`,
        err,
      );
      return null;
    }
  }
}
