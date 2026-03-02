export interface FetcherResult<T = any> {
  source: string;
  data: T | null;
  error?: string;
  fetchedAt: Date;
}

export type Fetcher<T = any> = (zip: string) => Promise<FetcherResult<T>>;
