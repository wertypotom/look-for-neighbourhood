import { Fetcher, FetcherResult } from './fetcher.types';

export const fetchTransit: Fetcher = async (
  zip: string,
): Promise<FetcherResult> => {
  return {
    source: 'Walk Score API',
    data: null,
    fetchedAt: new Date(),
  };
};
