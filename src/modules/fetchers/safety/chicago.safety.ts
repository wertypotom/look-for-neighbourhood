export const fetchChicagoSocrata = async (zip: string) => {
  try {
    // Chicago Data Portal (Crime - 2001 to Present)
    // We filter by Community Area or try to match Zip, but Chicago's primary API uses blocks
    // For MVP, we query recent crimes globally and would ideally map block coords to ZIP.
    // However, to keep it simple, we use a proxy query string for the ZIP.
    const url = `https://data.cityofchicago.org/resource/ijzp-q8t2.json?$where=block%20like%20%27%25${zip}%25%27&$limit=500`;

    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Chicago API Error: ${response.statusText}`);

    const data: any[] = await response.json();
    const crimeCounts: Record<string, number> = {};

    data.forEach((incident: any) => {
      // Chicago uses `primary_type`
      const type = incident.primary_type || 'Unknown';
      crimeCounts[type] = (crimeCounts[type] || 0) + 1;
    });

    const sortedCrimes = Object.entries(crimeCounts)
      .sort(([, a], [, b]) => b - a)
      .reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

    return {
      source: 'Chicago Data Portal',
      data: {
        recent_incidents_analyzed: data.length,
        breakdown: sortedCrimes,
      },
      fetchedAt: new Date(),
    };
  } catch (err: any) {
    return {
      source: 'Chicago Data Portal',
      data: null,
      error: err.message,
      fetchedAt: new Date(),
    };
  }
};
