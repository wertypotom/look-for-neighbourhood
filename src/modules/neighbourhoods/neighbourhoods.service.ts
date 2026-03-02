import * as NeighbourhoodModel from './neighbourhoods.model';
import { Neighbourhood } from './neighbourhoods.types';

export const getAllNeighbourhoods = async (): Promise<Neighbourhood[]> => {
  const data = await NeighbourhoodModel.getNeighbourhoods();
  return data;
};
