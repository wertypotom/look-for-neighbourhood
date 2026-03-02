import { Fetcher, FetcherResult } from './fetcher.types';
import { GeocodeService } from '../../utils/geocode';
import { getSafetyDataForCity } from './safety.adapter';

export const fetchSafety: Fetcher = async (
  zip: string,
): Promise<FetcherResult> => {
  try {
    const location = await GeocodeService.getCoordinatesForZip(zip);
    if (!location || !location.city) {
      return {
        source: 'Unknown City Safety Adapter',
        data: null,
        error: `Could not determine a city for ZIP: ${zip}`,
        fetchedAt: new Date(),
      };
    }

    return await getSafetyDataForCity(location.city, zip);
  } catch (err: any) {
    console.error(`[Safety] Error formatting request for ${zip}:`, err);
    return {
      source: 'Safety Adapter System',
      data: null,
      error: err.message,
      fetchedAt: new Date(),
    };
  }
};
