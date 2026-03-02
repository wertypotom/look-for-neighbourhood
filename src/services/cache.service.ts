import { supabase } from './supabase.client';

export class CacheService {
  /**
   * Gets parsed data from the Supabase cache where expires_at > NOW()
   */
  static async getCache<T>(key: string): Promise<T | null> {
    const { data, error } = await supabase
      .from('cache')
      .select('data')
      .eq('key', key)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      if (error && error.code !== 'PGRST116') {
        // PGRST116 is the PostgREST error for "0 rows returned" on a .single() query, which is expected on cache miss.
        console.warn(`[Cache GET] Failed to get cache for key: ${key}`, error);
      }
      return null;
    }

    return data.data as T;
  }

  /**
   * Sets data into the Supabase cache table via upsert.
   * @param key Unique string identifier
   * @param payload JSON serializable data
   * @param source String identifying the source API
   * @param ttlSeconds Number of seconds until the cache expires
   */
  static async setCache(
    key: string,
    payload: any,
    source: string,
    ttlSeconds: number,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    const { error } = await supabase.from('cache').upsert(
      {
        key,
        data: payload,
        source,
        expires_at: expiresAt,
      },
      { onConflict: 'key' }, // Requires the cache(key) to be a unique index/primary key
    );

    if (error) {
      console.error(`[Cache SET] Failed to set cache for key: ${key}`, error);
    }
  }
}
