import { Fetcher, FetcherResult } from './fetcher.types';

export const fetchSentiment: Fetcher = async (
  zip: string,
): Promise<FetcherResult> => {
  return {
    source: 'Reddit',
    data: null,
    fetchedAt: new Date(),
  };
};
