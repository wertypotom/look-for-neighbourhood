import { Fetcher, FetcherResult } from './fetcher.types';

export const fetchSafety: Fetcher = async (
  zip: string,
): Promise<FetcherResult> => {
  try {
    // Socrata API for Milwaukee WIBRS Crime Data
    // We filter by zip and limit to 500 most recent records to get a representative sample of crime types
    const url = `https://data.milwaukee.gov/resource/w7bg-zqb8.json?zip=${zip}&$limit=500`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LookForNeighbourhoodAPI/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Socrata API Error: ${response.statusText}`);
    }

    const data: any[] = await response.json();

    // Strategy 1: Aggregation
    // Instead of sending 500 raw crime objects to the LLM, we tally them by type
    const crimeCounts: Record<string, number> = {};

    data.forEach((incident: any) => {
      // The API uses `crimetype` or `offensedescription` depending on the dataset version.
      // We'll aggregate by `crimetype` for simplicity.
      const type = incident.crimetype || 'Unknown';
      crimeCounts[type] = (crimeCounts[type] || 0) + 1;
    });

    // Sort descending by frequency
    const sortedCrimes = Object.entries(crimeCounts)
      .sort(([, a], [, b]) => b - a)
      .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

    return {
      source: 'Milwaukee Socrata API',
      data: {
        recent_incidents_analyzed: data.length,
        breakdown: sortedCrimes,
      },
      fetchedAt: new Date(),
    };
  } catch (err: any) {
    console.error(`[Safety] Error fetching for ${zip}:`, err);
    return {
      source: 'Milwaukee Socrata API',
      data: null,
      error: err.message,
      fetchedAt: new Date(),
    };
  }
};
