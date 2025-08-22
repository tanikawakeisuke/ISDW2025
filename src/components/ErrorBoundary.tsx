'use client';

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#E9EACE] to-[#F7F9EF] p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
            <h1 className="text-2xl font-bold text-red-600 mb-4">⚠️ Application Error</h1>
            
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Error Details:</h2>
              <div className="bg-red-50 border border-red-200 rounded p-4 text-sm">
                <strong>Message:</strong> {this.state.error?.message || 'Unknown error'}
                <br />
                <strong>Stack:</strong>
                <pre className="mt-2 text-xs overflow-auto max-h-40 bg-gray-100 p-2 rounded">
                  {this.state.error?.stack || 'No stack trace available'}
                </pre>
              </div>
            </div>

            {this.state.errorInfo && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Component Stack:</h2>
                <div className="bg-gray-50 border border-gray-200 rounded p-4 text-sm">
                  <pre className="text-xs overflow-auto max-h-40">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">Environment Info:</h2>
              <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm">
                <strong>User Agent:</strong> {typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A'}
                <br />
                <strong>URL:</strong> {typeof window !== 'undefined' ? window.location.href : 'N/A'}
                <br />
                <strong>Timestamp:</strong> {new Date().toISOString()}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => window.location.reload()}
                className="bg-[#4F1412] hover:bg-[#3E100E] text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                🔄 Reload Page
              </button>
              
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: undefined, errorInfo: undefined });
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                🔧 Try Again
              </button>
            </div>

            <div className="mt-6 text-xs text-gray-500">
              <p>If this error persists, please copy the error details above and report the issue.</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;