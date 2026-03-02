export const fetchMilwaukeeSocrata = async (zip: string) => {
  try {
    const url = `https://data.milwaukee.gov/resource/w7bg-zqb8.json?zip=${zip}&$limit=500`;
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Socrata API Error: ${response.statusText}`);

    const data: any[] = await response.json();
    const crimeCounts: Record<string, number> = {};

    data.forEach((incident: any) => {
      const type = incident.crimetype || 'Unknown';
      crimeCounts[type] = (crimeCounts[type] || 0) + 1;
    });

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
    return {
      source: 'Milwaukee Socrata API',
      data: null,
      error: err.message,
      fetchedAt: new Date(),
    };
  }
};
