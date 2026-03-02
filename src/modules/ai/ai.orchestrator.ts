import { AggregatedFetchData } from '../fetchers';
import { AiService } from '../../services/ai/ai.service';
import { buildPrompt, buildMasterPrompt } from './prompts';

export interface EnrichedData {
  rentSummary: string;
  safetySummary: string;
  poisSummary: string;
  demographicsSummary: string;
  transitSummary: string;
  sentimentSummary: string;
  greenspaceSummary: string;
}

export interface ParallelEnrichmentResult {
  summaries: EnrichedData;
  recommendation: string;
}

/**
 * Strategy 2: Parallel Section-Scoped LLM Calls
 * Takes the massive raw aggregated JSON payload from the fetchers,
 * and spins up 7 tiny, targeted LLM calls in parallel.
 */
export const enrichDataParallel = async (
  rawData: AggregatedFetchData,
): Promise<ParallelEnrichmentResult> => {
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

  // 1. Stage 1: Run 7 Parallel Section Calls
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

  const summaries: EnrichedData = {
    rentSummary: rent,
    safetySummary: safety,
    poisSummary: pois,
    demographicsSummary: demo,
    transitSummary: transit,
    sentimentSummary: sentiment,
    greenspaceSummary: green,
  };

  // 2. Stage 2: Master Synthesis Call
  let recommendation = 'Synthesizing final recommendation...';
  try {
    const masterMessages = buildMasterPrompt(summaries);
    recommendation = await AiService.generateCompletion(masterMessages);
  } catch (err: any) {
    console.error(`[AI Enricher] Master Synthesis failed.`, err.message);
    recommendation =
      'Final synthesis failed. Please review individual sections.';
  }

  return {
    summaries,
    recommendation,
  };
};
