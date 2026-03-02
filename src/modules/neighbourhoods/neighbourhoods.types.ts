import { AggregatedFetchData } from '../fetchers';
import { EnrichedData } from '../ai/ai.orchestrator';

export interface Neighbourhood {
  id: string;
  name: string;
  city: string;
  population: number;
}

export interface NeighbourhoodReport {
  zip: string;
  raw_data: AggregatedFetchData;
  ai_summaries: EnrichedData;
  generated_at: Date;
}
