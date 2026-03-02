import { Fetcher, FetcherResult } from './fetcher.types';
import { GeocodeService } from '../../utils/geocode';

export const fetchPois: Fetcher = async (
  zip: string,
): Promise<FetcherResult> => {
  try {
    const coords = await GeocodeService.getCoordinatesForZip(zip);
    if (!coords) {
      return {
        source: 'OpenStreetMap POIs',
        data: null,
        error: `Could not determine coordinates for ZIP: ${zip}`,
        fetchedAt: new Date(),
      };
    }

    // Overpass QL to find all amenities within a 2km radius
    const overpassQuery = `
      [out:json][timeout:15];
      (
        node["amenity"](around:2000,${coords.lat},${coords.lng});
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
    const amenityCounts: Record<string, number> = {};
    elements.forEach((el: any) => {
      if (el.tags && el.tags.amenity) {
        const type = el.tags.amenity;
        amenityCounts[type] = (amenityCounts[type] || 0) + 1;
      }
    });

    // Sort tallies descending
    const sortedAmenities = Object.entries(amenityCounts)
      .sort(([, a], [, b]) => b - a)
      .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

    return {
      source: 'OpenStreetMap POIs',
      data: {
        total_amenities: elements.length,
        breakdown: sortedAmenities,
      },
      fetchedAt: new Date(),
    };
  } catch (err: any) {
    console.error(`[POIs] Error fetching for ${zip}:`, err);
    return {
      source: 'OpenStreetMap POIs',
      data: null,
      error: err.message,
      fetchedAt: new Date(),
    };
  }
};
