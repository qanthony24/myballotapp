import React, { Component, ErrorInfo } from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="max-w-lg mx-auto mt-20 p-8 bg-white rounded-xl border border-red-200 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-midnight-navy mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-500 mb-4">
            This page ran into an error. Try refreshing, or go back to the homepage.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-civic-blue text-white rounded-md text-sm font-medium hover:bg-opacity-90"
            >
              Refresh Page
            </button>
            <a
              href="/#/"
              className="px-4 py-2 bg-gray-100 text-midnight-navy rounded-md text-sm font-medium hover:bg-gray-200"
            >
              Go Home
            </a>
          </div>
          {this.state.error && (
            <details className="mt-4 text-left">
              <summary className="text-xs text-gray-400 cursor-pointer">Technical details</summary>
              <pre className="mt-2 p-3 bg-gray-50 rounded text-xs text-red-600 overflow-x-auto">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
