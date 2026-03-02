import { Neighbourhood } from './neighbourhoods.types';

// Simple mock data for now
const mockNeighbourhoods: Neighbourhood[] = [
  { id: '1', name: 'Downtown', city: 'Metropolis', population: 50000 },
  { id: '2', name: 'Uptown', city: 'Metropolis', population: 35000 },
  { id: '3', name: 'Riverside', city: 'Metropolis', population: 20000 },
];

export const getNeighbourhoods = async (): Promise<Neighbourhood[]> => {
  // Simulate DB call
  return Promise.resolve(mockNeighbourhoods);
};
