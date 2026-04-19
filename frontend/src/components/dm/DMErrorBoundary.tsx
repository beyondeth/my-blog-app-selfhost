'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary for DM System
 * Catches and handles errors gracefully in production
 */
class DMErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to error reporting service
    console.error('DM Error Boundary caught an error:', error, errorInfo);

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
      this.logErrorToService(error, errorInfo);
    }
  }

  logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // Send error to tracking service
    // This is where you'd integrate with Sentry, LogRocket, etc.
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'SSR',
    };

    // Example API call to error tracking service
    if (typeof window !== 'undefined') {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      fetch(`${apiUrl}/errors/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData),
      }).catch(err => {
        console.error('Failed to log error to service:', err);
      });
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // Default error UI
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="max-w-md w-full mx-auto p-6">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>

              <h2 className="text-2xl font-semibold text-center text-gray-900 mb-2">
                Chat unavailable
              </h2>

              <p className="text-gray-600 text-center mb-6">
                Something went wrong in the chat system.
                Please try again in a moment.
              </p>

              {/* Error details for development */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mb-6 p-4 bg-gray-100 rounded-lg">
                  <p className="text-sm font-mono text-red-600 mb-2">
                    {this.state.error.message}
                  </p>
                  <details className="text-xs text-gray-600">
                    <summary className="cursor-pointer font-semibold mb-1">
                      Stack trace
                    </summary>
                    <pre className="overflow-auto max-h-40 p-2 bg-white rounded mt-2">
                      {this.state.error.stack}
                    </pre>
                  </details>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={this.handleReset}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Try again
                </button>

                <button
                  onClick={this.handleRefresh}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>

            {/* Additional help text */}
            <p className="text-center text-sm text-gray-500 mt-4">
              If the issue continues, contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default DMErrorBoundary;
