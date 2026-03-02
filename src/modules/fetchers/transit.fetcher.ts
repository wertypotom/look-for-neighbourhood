import { Fetcher, FetcherResult } from './fetcher.types';
import { GeocodeService } from '../../utils/geocode';

export const fetchTransit: Fetcher = async (
  zip: string,
): Promise<FetcherResult> => {
  try {
    const location = await GeocodeService.getCoordinatesForZip(zip);
    if (!location) {
      return {
        source: 'OpenStreetMap Transit',
        data: null,
        error: `Could not determine location for ZIP: ${zip}`,
        fetchedAt: new Date(),
      };
    }

    // Overpass QL to find bus and tram stops within a 1km radius
    const overpassQuery = `
      [out:json][timeout:15];
      (
        node["highway"="bus_stop"](around:1000,${location.lat},${location.lng});
        node["railway"="tram_stop"](around:1000,${location.lat},${location.lng});
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

    // Strategy 1: Aggregation
    let busStops = 0;
    let tramStops = 0;

    elements.forEach((el: any) => {
      if (el.tags) {
        if (el.tags.highway === 'bus_stop') busStops++;
        if (el.tags.railway === 'tram_stop') tramStops++;
      }
    });

    return {
      source: 'OpenStreetMap Transit',
      data: {
        total_stops_within_1km: elements.length,
        breakdown: {
          bus_stops: busStops,
          tram_stops: tramStops,
        },
      },
      fetchedAt: new Date(),
    };
  } catch (err: any) {
    console.error(`[Transit] Error fetching for ${zip}:`, err);
    return {
      source: 'OpenStreetMap Transit',
      data: null,
      error: err.message,
      fetchedAt: new Date(),
    };
  }
};
