import { Fetcher, FetcherResult } from './fetcher.types';

export const fetchPois: Fetcher = async (
  zip: string,
): Promise<FetcherResult> => {
  return {
    source: 'OpenStreetMap POIs',
    data: null,
    fetchedAt: new Date(),
  };
};
