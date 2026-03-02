import * as NeighbourhoodModel from './neighbourhoods.model';
import { Neighbourhood, NeighbourhoodReport } from './neighbourhoods.types';
import { fetchAll } from '../fetchers';
import { enrichDataParallel } from '../ai/ai.orchestrator';
import { CacheService } from '../../services/cache.service';
import { logger } from '../../utils/logger';

export const getAllNeighbourhoods = async (): Promise<Neighbourhood[]> => {
  const data = await NeighbourhoodModel.getNeighbourhoods();
  return data;
};

/**
 * Main entry point to get full enriched data for a given zip code.
 */
export const getNeighbourhoodReport = async (
  zip: string,
): Promise<NeighbourhoodReport> => {
  console.log(`[NeighbourhoodsService] Fetching data for zip: ${zip}...`);

  // 1. Check Full Report Cache (7 days TTL)
  // We use the 'report' source tag to distinguish from raw API caches
  const cacheKey = `report:${zip}`;
  const cachedReport = await CacheService.getCache(cacheKey);

  if (cachedReport) {
    console.log(`[NeighbourhoodsService] Cache hit for full report: ${zip}`);
    // Assume stored cache matches our interface
    return cachedReport as NeighbourhoodReport;
  }

  // 2. Trigger all 7 API fetchers in parallel
  console.log(
    `[NeighbourhoodsService] Cache miss. Initiating parallel fetchers...`,
  );
  const rawData = await fetchAll(zip);

  // 3. Pass raw aggregated data into the AI Parallel Enricher
  console.log(
    `[NeighbourhoodsService] Fetchers complete. Initiating AI parallel enrichment...`,
  );
  const aiSummaries = await enrichDataParallel(rawData);

  // 4. Assemble final report
  const finalReport: NeighbourhoodReport = {
    zip,
    raw_data: rawData,
    ai_summaries: aiSummaries,
    generated_at: new Date(),
  };

  // 5. Save final payload to cache (604800 seconds = 7 days)
  await CacheService.setCache(cacheKey, finalReport, 'Full_Report', 604800);

  return finalReport;
};
