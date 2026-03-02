import { Fetcher, FetcherResult } from './fetcher.types';

export const fetchDemographics: Fetcher = async (
  zip: string,
): Promise<FetcherResult> => {
  return {
    source: 'Census ACS',
    data: null,
    fetchedAt: new Date(),
  };
};
