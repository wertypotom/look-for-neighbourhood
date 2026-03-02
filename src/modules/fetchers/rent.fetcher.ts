import { Fetcher, FetcherResult } from './fetcher.types';
import { supabase } from '../../services/supabase.client';

export const fetchRent: Fetcher = async (
  zip: string,
): Promise<FetcherResult> => {
  try {
    const { data, error } = await supabase
      .from('rent_data')
      .select('median_rent, updated_at')
      .eq('zip_code', zip)
      .single();

    if (error || !data) {
      return {
        source: 'Zillow ZORI',
        data: null,
        error: error?.message || 'No rent data found for this ZIP',
        fetchedAt: new Date(),
      };
    }

    return {
      source: 'Zillow ZORI',
      data: {
        median_rent: data.median_rent,
        updated_at: data.updated_at,
      },
      fetchedAt: new Date(),
    };
  } catch (err: any) {
    return {
      source: 'Zillow ZORI',
      data: null,
      error: err.message,
      fetchedAt: new Date(),
    };
  }
};
