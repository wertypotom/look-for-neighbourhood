import { Fetcher, FetcherResult } from './fetcher.types';

export const fetchDemographics: Fetcher = async (
  zip: string,
): Promise<FetcherResult> => {
  try {
    // US Census API (American Community Survey - ACS5)
    // DP02_0001E: Total Households
    // DP03_0062E: Median Household Income
    const url = `https://api.census.gov/data/2021/acs/acs5/profile?get=DP02_0001E,DP03_0062E&for=zip%20code%20tabulation%20area:${zip}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Census API Error: ${response.statusText}`);
    }

    const data = await response.json();

    // The response is an array of arrays. Index 0 is headers, Index 1 is the data row.
    // Example: [["DP02_0001E","DP03_0062E","zip code tabulation area"],["12345","67890","53202"]]
    if (!data || data.length < 2) {
      throw new Error('Unexpected Census data format or empty results');
    }

    const totalHouseholds = parseInt(data[1][0], 10);
    const medianIncome = parseInt(data[1][1], 10);

    return {
      source: 'US Census Bureau (ACS5)',
      data: {
        total_households: isNaN(totalHouseholds) ? null : totalHouseholds,
        median_household_income: isNaN(medianIncome) ? null : medianIncome,
      },
      fetchedAt: new Date(),
    };
  } catch (err: any) {
    console.error(`[Demographics] Error fetching for ${zip}:`, err);
    return {
      source: 'US Census Bureau',
      data: null,
      error: err.message,
      fetchedAt: new Date(),
    };
  }
};
