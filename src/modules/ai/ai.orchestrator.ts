import { AggregatedFetchData } from '../fetchers';
import { AiService } from '../../services/ai/ai.service';
import { buildPrompt } from './prompts';

export interface EnrichedData {
  rentSummary: string;
  safetySummary: string;
  poisSummary: string;
  demographicsSummary: string;
  transitSummary: string;
  sentimentSummary: string;
  greenspaceSummary: string;
}

/**
 * Strategy 2: Parallel Section-Scoped LLM Calls
 * Takes the massive raw aggregated JSON payload from the fetchers,
 * and spins up 7 tiny, targeted LLM calls in parallel.
 */
export const enrichDataParallel = async (
  rawData: AggregatedFetchData,
): Promise<EnrichedData> => {
  // Helper to run one LLM call safely with fallback
  const safeLlmCall = async (section: string, data: any): Promise<string> => {
    try {
      if (!data || data.error) return 'Data unavailable for this region.';
      const messages = buildPrompt(section, data);
      return await AiService.generateCompletion(messages);
    } catch (err: any) {
      console.warn(
        `[AI Enricher] Failed on '${section}'. Fallback to stringify.`,
        err.message,
      );
      // Graceful degradation: If Abacus fails, just return the raw data stringified
      return typeof data?.data === 'object'
        ? JSON.stringify(data.data).substring(0, 150) + '...'
        : 'Processing failed.';
    }
  };

  // Run all 7 requests concurrently
  const [rent, safety, pois, demo, transit, sentiment, green] =
    await Promise.all([
      safeLlmCall('rent', rawData.rent),
      safeLlmCall('safety', rawData.safety),
      safeLlmCall('pois', rawData.pois),
      safeLlmCall('demographics', rawData.demographics),
      safeLlmCall('transit', rawData.transit),
      safeLlmCall('sentiment', rawData.sentiment),
      safeLlmCall('greenspace', rawData.greenspace),
    ]);

  return {
    rentSummary: rent,
    safetySummary: safety,
    poisSummary: pois,
    demographicsSummary: demo,
    transitSummary: transit,
    sentimentSummary: sentiment,
    greenspaceSummary: green,
  };
};
