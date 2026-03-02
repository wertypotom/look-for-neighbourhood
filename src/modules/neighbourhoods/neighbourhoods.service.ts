import * as NeighbourhoodModel from './neighbourhoods.model';
import { Neighbourhood } from './neighbourhoods.types';
import { fetchAll, AggregatedFetchData } from '../fetchers';

export const getAllNeighbourhoods = async (): Promise<Neighbourhood[]> => {
  const data = await NeighbourhoodModel.getNeighbourhoods();
  return data;
};

/**
 * Main entry point to get data for a given zip code.
 * Currently just orchestrates the fetchers.
 */
export const getNeighbourhoodReport = async (
  zip: string,
): Promise<AggregatedFetchData> => {
  console.log(`[NeighbourhoodsService] Fetching data for zip: ${zip}...`);
  // Trigger all fetchers in parallel
  const rawData = await fetchAll(zip);
  return rawData;
};
