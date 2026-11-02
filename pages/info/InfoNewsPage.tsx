import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  NewspaperIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { NewsArticle } from '../../types/info';
import { fetchNewsFeed, formatRelativeTime } from '../../services/newsService';
import NewsFeedCard from '../../components/info/NewsFeedCard';
import { subscribeNews, subscribeNewsStatus, type LiveArticle } from '../../services/newsSocial';

const SkeletonCard: React.FC = () => (
  <div className="bg-white rounded-lg border border-midnight-navy/10 overflow-hidden animate-pulse">
    <div className="h-48 bg-gray-200" />
    <div className="p-4 space-y-3">
      <div className="h-4 w-20 bg-gray-200 rounded-full" />
      <div className="h-5 w-3/4 bg-gray-200 rounded" />
      <div className="space-y-2">
        <div className="h-3 w-full bg-gray-200 rounded" />
        <div className="h-3 w-5/6 bg-gray-200 rounded" />
      </div>
      <div className="h-3 w-24 bg-gray-200 rounded" />
    </div>
  </div>
);

const INFO_SECTIONS = [
  { to: '/info/how-to-vote', icon: CalendarDaysIcon, label: 'How to Vote' },
  { to: '/info/results', icon: ChartBarIcon, label: 'Results' },
];

const InfoNewsPage: React.FC = () => {
  const [articles, setArticles] = useState<(NewsArticle | LiveArticle)[]>([]);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Live = articles from Firestore (refreshed every 30 min by the refreshNews function), with reactions and comments.
  // Until that function has run (or if Firestore is unreachable), fall back to the bundled static feed.
  const [live, setLive] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const loadStatic = async () => {
    try {
      const data = await fetchNewsFeed();
      setArticles(data.items);
      setLastRefreshedAt(data.lastRefreshedAt);
      setLive(false);
    } catch {
      setError('Unable to load the news feed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    const stopStatus = subscribeNewsStatus((s) => s?.lastRefreshedAt && setLastRefreshedAt(s.lastRefreshedAt));
    const stopNews = subscribeNews(
      (items) => {
        if (items.length === 0) return void loadStatic();
        setArticles(items);
        setLive(true);
        setLoading(false);
      },
      () => void loadStatic(),
    );
    return () => {
      stopStatus();
      stopNews();
    };
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFeed = () => setAttempt((n) => n + 1);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Quick-nav strip for other Info sections */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
        {INFO_SECTIONS.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-midnight-navy/15 bg-white text-midnight-navy/80 text-xs font-medium whitespace-nowrap hover:bg-civic-blue hover:text-white hover:border-civic-blue transition-colors shadow-sm"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <NewspaperIcon className="h-7 w-7 text-civic-blue" />
        <h1 className="text-2xl font-display font-bold text-midnight-navy">
          Louisiana Political News
        </h1>
      </div>
      <p className="text-xs text-midnight-navy/60 mb-3">
        Politics coverage from The Advocate, NOLA.com, The Acadiana Advocate and the Shreveport-Bossier Advocate, plus everything from the
        Louisiana Illuminator and The Bayou Progressive. Articles open on the publisher&apos;s site. Reactions and comments come from MyBallot
        users, not the newsrooms or MyBallot.
      </p>

      {/* Meta bar */}
      <div className="flex items-center justify-between mb-5">
        {lastRefreshedAt && (
          <p className="text-xs text-midnight-navy/50">
            Last updated {formatRelativeTime(lastRefreshedAt)}
          </p>
        )}
        <button
          onClick={loadFeed}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-civic-blue hover:text-sunlight-gold transition-colors disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="text-center py-16">
          <p className="text-midnight-navy/70 mb-4">{error}</p>
          <button
            onClick={loadFeed}
            className="bg-civic-blue text-white font-semibold px-5 py-2 rounded-md hover:bg-opacity-80 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && articles.length === 0 && (
        <div className="text-center py-16">
          <NewspaperIcon className="h-12 w-12 text-midnight-navy/20 mx-auto mb-4" />
          <p className="text-midnight-navy/60">No news articles available right now.</p>
        </div>
      )}

      {/* Article list */}
      {!loading && !error && articles.length > 0 && (
        <div className="grid grid-cols-1 gap-5">
          {articles.map((article) => (
            <NewsFeedCard key={article.id} article={article} social={live} />
          ))}
        </div>
      )}
    </div>
  );
};

export default InfoNewsPage;
