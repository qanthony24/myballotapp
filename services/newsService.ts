import type { NewsArticle, NewsFeedResponse } from '../types/info';

const NEWS_FEED_URL = '/data/news/feed.json';

export async function fetchNewsFeed(
  options?: { limit?: number }
): Promise<{ items: NewsArticle[]; lastRefreshedAt: string }> {
  try {
    const res = await fetch(NEWS_FEED_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data: NewsFeedResponse = await res.json();

    data.items.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    if (options?.limit && options.limit > 0) {
      data.items = data.items.slice(0, options.limit);
    }

    return data;
  } catch (err) {
    console.warn('fetchNewsFeed failed:', err);
    return { items: [], lastRefreshedAt: new Date().toISOString() };
  }
}

export function formatRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  const date = new Date(dateString);
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${monthNames[date.getMonth()]} ${date.getDate()}`;
}
