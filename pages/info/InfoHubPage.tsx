import React from 'react';
import { Link } from 'react-router-dom';
import {
  InformationCircleIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  NewspaperIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

interface SectionCard {
  title: string;
  description: string;
  to: string;
  icon: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement>>;
}

const sections: SectionCard[] = [
  {
    title: 'Election Essentials',
    description: 'Key dates, polling places, and voter resources',
    to: '/info/essentials',
    icon: CalendarDaysIcon,
  },
  {
    title: 'Ask a Question',
    description: 'Get answers about elections and voting',
    to: '/info/qa',
    icon: ChatBubbleLeftRightIcon,
  },
  {
    title: 'Louisiana Political News',
    description: 'Latest headlines from Louisiana politics',
    to: '/info/news',
    icon: NewspaperIcon,
  },
  {
    title: 'Past Election Results',
    description: 'Browse historical election outcomes and data',
    to: '/info/results',
    icon: ChartBarIcon,
  },
];

const InfoHubPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-xl rounded-lg p-6 md:p-10 border border-midnight-navy/10">
        <h1 className="text-3xl font-display font-bold text-midnight-navy mb-8 text-center flex items-center justify-center">
          <InformationCircleIcon className="h-9 w-9 mr-3 text-civic-blue" />
          Information Hub
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.to}
                to={section.to}
                className="group flex items-start gap-4 p-6 bg-slate-50 rounded-lg shadow border border-midnight-navy/10 hover:shadow-lg hover:border-civic-blue/40 transition-all duration-200"
              >
                <Icon className="h-8 w-8 text-civic-blue flex-shrink-0 mt-0.5 group-hover:text-sunlight-gold transition-colors duration-200" />
                <div>
                  <h2 className="text-lg font-display font-semibold text-midnight-navy group-hover:text-civic-blue transition-colors duration-200">
                    {section.title}
                  </h2>
                  <p className="text-sm text-midnight-navy/70 mt-1 font-sans">
                    {section.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default InfoHubPage;
