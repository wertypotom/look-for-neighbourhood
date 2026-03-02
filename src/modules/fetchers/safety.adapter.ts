import { fetchMilwaukeeSocrata } from './safety/milwaukee.safety';
import { fetchChicagoSocrata } from './safety/chicago.safety';

export const getSafetyDataForCity = async (city: string, zip: string) => {
  const normalizedCity = city.toLowerCase().trim();

  // Mapping of supported cities to their adapter functions
  const adapters: Record<string, Function> = {
    milwaukee: fetchMilwaukeeSocrata,
    chicago: fetchChicagoSocrata,
  };

  const adapter = adapters[normalizedCity];

  if (adapter) {
    return await adapter(zip);
  }

  // Graceful degradation for unsupported cities
  return {
    source: `Unsupported City: ${city}`,
    data: null,
    error: `Safety data is not yet integrated for ${city}. Try Milwaukee or Chicago.`,
    fetchedAt: new Date(),
  };
};
