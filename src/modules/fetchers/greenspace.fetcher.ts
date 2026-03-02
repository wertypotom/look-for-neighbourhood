import { Fetcher, FetcherResult } from './fetcher.types';
import { GeocodeService } from '../../utils/geocode';

export const fetchGreenspace: Fetcher = async (
  zip: string,
): Promise<FetcherResult> => {
  try {
    const location = await GeocodeService.getCoordinatesForZip(zip);
    if (!location) {
      return {
        source: 'OpenStreetMap Parks',
        data: null,
        error: `Could not determine location for ZIP: ${zip}`,
        fetchedAt: new Date(),
      };
    }

    // Overpass QL to find parks and nature reserves within a 2km radius
    const overpassQuery = `
      [out:json][timeout:15];
      (
        nwr["leisure"="park"](around:2000,${location.lat},${location.lng});
        nwr["leisure"="nature_reserve"](around:2000,${location.lat},${location.lng});
      );
      out tags;
    `;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: overpassQuery,
      headers: {
        'User-Agent': 'LookForNeighbourhoodAPI/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Overpass API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const elements = data.elements || [];

    // Apply Strategy 1: Aggregation
    let totalParks = 0;
    let totalReserves = 0;

    elements.forEach((el: any) => {
      if (el.tags && el.tags.leisure) {
        if (el.tags.leisure === 'park') totalParks++;
        if (el.tags.leisure === 'nature_reserve') totalReserves++;
      }
    });

    return {
      source: 'OpenStreetMap Parks',
      data: {
        total_greenspaces_found: elements.length,
        breakdown: {
          parks: totalParks,
          nature_reserves: totalReserves,
        },
      },
      fetchedAt: new Date(),
    };
  } catch (err: any) {
    console.error(`[Greenspace] Error fetching for ${zip}:`, err);
    return {
      source: 'OpenStreetMap Parks',
      data: null,
      error: err.message,
      fetchedAt: new Date(),
    };
  }
};
