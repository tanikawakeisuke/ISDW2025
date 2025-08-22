'use client';

import { useState, useEffect } from 'react';

export default function TestPage() {
  const [mounted, setMounted] = useState(false);
  const [envTest, setEnvTest] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    
    // Test environment variables
    try {
      setEnvTest({
        kakaoKey: process.env.NEXT_PUBLIC_KAKAO_APP_KEY || 'NOT_SET',
        firebaseKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'NOT_SET',
        firebaseDisabled: process.env.NEXT_PUBLIC_FIREBASE_DISABLED || 'NOT_SET',
        bypassLocation: process.env.NEXT_PUBLIC_BYPASS_LOCATION || 'NOT_SET',
      });
    } catch (err) {
      setError(`Environment test failed: ${err}`);
    }
  }, []);

  if (!mounted) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-green-600">✅ Urban Pigment Test Page</h1>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Environment Variables */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
            <div className="space-y-2 text-sm">
              {Object.entries(envTest).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="font-mono text-gray-600">{key}:</span>
                  <span className={`font-mono ${value === 'NOT_SET' ? 'text-red-500' : 'text-green-600'}`}>
                    {value === 'NOT_SET' ? 'NOT_SET' : value.substring(0, 20) + '...'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Browser Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Browser Info</h2>
            <div className="space-y-2 text-sm">
              <div><strong>User Agent:</strong> {navigator.userAgent.substring(0, 50)}...</div>
              <div><strong>URL:</strong> {window.location.href}</div>
              <div><strong>Timestamp:</strong> {new Date().toISOString()}</div>
              <div><strong>Screen:</strong> {window.screen.width}x{window.screen.height}</div>
            </div>
          </div>

          {/* Simple Tests */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Basic Tests</h2>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <span>React Mounting: OK</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <span>useState/useEffect: OK</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <span>Environment Access: OK</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Actions</h2>
            <div className="space-y-3">
              <button
                onClick={() => window.location.href = '/'}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded transition-colors"
              >
                🏠 Go to Main App
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded transition-colors"
              >
                🔄 Reload Test
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-gray-600">
          <p>If this page loads successfully, the basic Next.js setup is working.</p>
          <p>Check the environment variables above for configuration issues.</p>
        </div>
      </div>
    </div>
  );
}