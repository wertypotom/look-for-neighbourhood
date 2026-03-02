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
  logger.info(`[NeighbourhoodsService] Generating report for ZIP: ${zip}`);
  const startTime = Date.now();

  const cacheKey = `report:${zip}`;
  const cachedReport = await CacheService.getCache(cacheKey);

  if (cachedReport) {
    logger.info(`[NeighbourhoodsService] Cache hit for ZIP: ${zip}`);
    return cachedReport as NeighbourhoodReport;
  }

  const rawData = await fetchAll(zip);

  const aiSummaries = await enrichDataParallel(rawData);

  const finalReport: NeighbourhoodReport = {
    zip,
    raw_data: rawData,
    ai_summaries: aiSummaries,
    generated_at: new Date(),
  };

  await CacheService.setCache(cacheKey, finalReport, 'Full_Report', 604800);

  const duration = Date.now() - startTime;
  logger.info(
    `[NeighbourhoodsService] Report generated in ${duration}ms for ZIP: ${zip}`,
  );

  return finalReport;
};
