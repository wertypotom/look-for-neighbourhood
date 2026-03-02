import { Fetcher, FetcherResult } from './fetcher.types';

export const fetchRent: Fetcher = async (
  zip: string,
): Promise<FetcherResult> => {
  return {
    source: 'Zillow ZORI',
    data: null,
    fetchedAt: new Date(),
  };
};
