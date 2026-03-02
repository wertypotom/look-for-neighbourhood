import { fetchMilwaukeeSocrata } from './safety/milwaukee.safety';
import { fetchChicagoSocrata } from './safety/chicago.safety';

export const getSafetyDataForCity = async (city: string, zip: string) => {
  const normalizedCity = city.toLowerCase().trim();

  // Mapping of 10 supported US cities to their adapter functions/urls
  const adapters: Record<string, Function> = {
    milwaukee: fetchMilwaukeeSocrata,
    chicago: fetchChicagoSocrata,
    'new york': async (z: string) => ({
      source: 'NY API',
      data: null,
      error: 'NY implementation pending',
    }),
    'los angeles': async (z: string) => ({
      source: 'LA API',
      data: null,
      error: 'LA implementation pending',
    }),
    houston: async (z: string) => ({
      source: 'Houston API',
      data: null,
      error: 'Houston implementation pending',
    }),
    phoenix: async (z: string) => ({
      source: 'Phoenix API',
      data: null,
      error: 'Phoenix implementation pending',
    }),
    philadelphia: async (z: string) => ({
      source: 'Philly API',
      data: null,
      error: 'Philly implementation pending',
    }),
    'san antonio': async (z: string) => ({
      source: 'San Antonio API',
      data: null,
      error: 'San Antonio implementation pending',
    }),
    'san diego': async (z: string) => ({
      source: 'San Diego API',
      data: null,
      error: 'San Diego implementation pending',
    }),
    dallas: async (z: string) => ({
      source: 'Dallas API',
      data: null,
      error: 'Dallas implementation pending',
    }),
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
