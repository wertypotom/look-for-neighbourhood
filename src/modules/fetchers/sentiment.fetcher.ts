import { Fetcher, FetcherResult } from './fetcher.types';
import { GeocodeService } from '../../utils/geocode';

export interface MinimizedRedditPost {
  title: string;
  score: number;
  url: string;
  excerpt: string;
}

export const fetchSentiment: Fetcher = async (
  zip: string,
): Promise<FetcherResult> => {
  try {
    const location = await GeocodeService.getCoordinatesForZip(zip);

    // Default to 'milwaukee' if resolving fails, but strip spaces for subreddit formatting
    const rawCity = location ? location.city : 'milwaukee';
    const subreddit = rawCity.toLowerCase().replace(/[\s-]/g, '');

    const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${zip}&restrict_sr=1&sort=top`;

    // Reddit asks for descriptive User-Agents
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LookForNeighbourhoodAPI/1.0',
      },
    });

    if (!response.ok) {
      console.error(
        `[Reddit] Failed to fetch sentiment for ${zip}: ${response.statusText}`,
      );
      return {
        source: 'Reddit r/milwaukee',
        data: null,
        error: `HTTP ${response.status}: ${response.statusText}`,
        fetchedAt: new Date(),
      };
    }

    const json = await response.json();
    const children = json?.data?.children || [];

    // Filter to top 10 and map to minimized format (Strategy 4)
    const topPosts: MinimizedRedditPost[] = children
      .slice(0, 10)
      .map((child: any) => {
        const post = child.data;
        const selftext = post.selftext || '';

        // Naive 2-sentence extraction based on standard punctuation
        const sentences = selftext.match(/[^.!?]+[.!?]+/g) || [selftext];
        const excerpt = sentences.slice(0, 2).join(' ').trim();

        return {
          title: post.title,
          score: post.score,
          url: `https://reddit.com${post.permalink}`,
          excerpt: excerpt || 'No description provided.',
        };
      });

    return {
      source: 'Reddit r/milwaukee',
      data: {
        posts: topPosts,
        total_found: children.length,
      },
      fetchedAt: new Date(),
    };
  } catch (err: any) {
    console.error(`[Reddit] Error processing sentiment for ${zip}`, err);
    return {
      source: 'Reddit r/milwaukee',
      data: null,
      error: err.message || 'Unknown parsing error',
      fetchedAt: new Date(),
    };
  }
};
