import React, { useState } from 'react';
import { NewsArticle } from '../../types/info';
import { formatRelativeTime } from '../../services/newsService';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

interface NewsFeedCardProps {
  article: NewsArticle;
}

const NewsFeedCard: React.FC<NewsFeedCardProps> = ({ article }) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="bg-white shadow-sm rounded-lg border border-midnight-navy/10 overflow-hidden transition-shadow hover:shadow-md">
      {article.imageUrl && !imgError && (
        <img
          src={article.imageUrl}
          alt=""
          className="w-full h-48 object-cover"
          onError={() => setImgError(true)}
        />
      )}

      <div className="p-4 space-y-3">
        <span className="inline-block bg-slate-100 text-midnight-navy/80 text-xs font-medium px-2.5 py-0.5 rounded-full">
          {article.source}
        </span>

        <h3 className="text-lg font-display font-bold text-midnight-navy leading-snug">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-civic-blue transition-colors inline-flex items-start gap-1"
          >
            {article.title}
            <ArrowTopRightOnSquareIcon className="h-4 w-4 flex-shrink-0 mt-1 text-midnight-navy/40" />
          </a>
        </h3>

        {article.summary && (
          <p className="text-sm text-midnight-navy/70 line-clamp-3">
            {article.summary}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-midnight-navy/50 pt-1">
          <time dateTime={article.publishedAt}>
            {formatRelativeTime(article.publishedAt)}
          </time>
          {article.author && (
            <>
              <span aria-hidden="true">&middot;</span>
              <span>{article.author}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewsFeedCard;
