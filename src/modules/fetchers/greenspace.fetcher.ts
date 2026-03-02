import { Fetcher, FetcherResult } from './fetcher.types';

export const fetchGreenspace: Fetcher = async (
  zip: string,
): Promise<FetcherResult> => {
  return {
    source: 'OpenStreetMap Parks',
    data: null,
    fetchedAt: new Date(),
  };
};
