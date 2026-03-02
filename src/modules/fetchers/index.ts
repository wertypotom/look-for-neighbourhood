import { FetcherResult } from './fetcher.types';
import { fetchRent } from './rent.fetcher';
import { fetchSafety } from './safety.fetcher';
import { fetchPois } from './pois.fetcher';
import { fetchDemographics } from './demographics.fetcher';
import { fetchTransit } from './transit.fetcher';
import { fetchSentiment } from './sentiment.fetcher';
import { fetchGreenspace } from './greenspace.fetcher';
import { logger } from '../../utils/logger';

export interface AggregatedFetchData {
  rent: FetcherResult | null;
  safety: FetcherResult | null;
  pois: FetcherResult | null;
  demographics: FetcherResult | null;
  transit: FetcherResult | null;
  sentiment: FetcherResult | null;
  greenspace: FetcherResult | null;
}

/**
 * Orchestrator function to fetch all neighbourhood data in parallel.
 * Uses Promise.allSettled to ensure individual API failures don't crash
 * the whole request (Graceful Degradation).
 */
export const fetchAll = async (zip: string): Promise<AggregatedFetchData> => {
  logger.info(`[FetchAll] Starting parallel fetch for ZIP: ${zip}`);
  const startTime = Date.now();

  const [
    rentRes,
    safetyRes,
    poisRes,
    demoRes,
    transitRes,
    sentimentRes,
    greenRes,
  ] = await Promise.allSettled([
    fetchRent(zip),
    fetchSafety(zip),
    fetchPois(zip),
    fetchDemographics(zip),
    fetchTransit(zip),
    fetchSentiment(zip),
    fetchGreenspace(zip),
  ]);

  const duration = Date.now() - startTime;

  const results = [
    rentRes,
    safetyRes,
    poisRes,
    demoRes,
    transitRes,
    sentimentRes,
    greenRes,
  ];
  const fulfilledCount = results.filter((r) => r.status === 'fulfilled').length;
  const rejectedCount = results.filter((r) => r.status === 'rejected').length;

  logger.info(
    `[FetchAll] Completed in ${duration}ms. Success: ${fulfilledCount}, Failed: ${rejectedCount}`,
  );

  return {
    rent: rentRes.status === 'fulfilled' ? rentRes.value : null,
    safety: safetyRes.status === 'fulfilled' ? safetyRes.value : null,
    pois: poisRes.status === 'fulfilled' ? poisRes.value : null,
    demographics: demoRes.status === 'fulfilled' ? demoRes.value : null,
    transit: transitRes.status === 'fulfilled' ? transitRes.value : null,
    sentiment: sentimentRes.status === 'fulfilled' ? sentimentRes.value : null,
    greenspace: greenRes.status === 'fulfilled' ? greenRes.value : null,
  };
};
