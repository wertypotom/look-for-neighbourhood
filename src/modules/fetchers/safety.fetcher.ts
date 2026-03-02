import { Fetcher, FetcherResult } from './fetcher.types';

export const fetchSafety: Fetcher = async (
  zip: string,
): Promise<FetcherResult> => {
  return {
    source: 'Socrata API',
    data: null,
    fetchedAt: new Date(),
  };
};
