'use client';

import { useState, useEffect } from 'react';
import { Palette, Users, Clock, Settings, Coffee } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamically import components that depend on browser APIs
const CafeMap = dynamic(() => import('@/components/CafeMap').then(mod => ({ default: mod.CafeMap })), {
  ssr: false,
  loading: () => <div className="w-full h-96 bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">Loading Map...</div>
});

const PlaceCanvas = dynamic(() => import('@/components/PlaceCanvas').then(mod => ({ default: mod.PlaceCanvas })), {
  ssr: false,
  loading: () => <div className="w-full h-96 bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">Loading Canvas...</div>
});

const PigmentPalette = dynamic(() => import('@/components/PigmentPalette').then(mod => ({ default: mod.PigmentPalette })), {
  ssr: false,
  loading: () => <div className="w-full h-32 bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">Loading Palette...</div>
});
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/hooks/useLocation';
import { useCafeCollection } from '@/hooks/useCafeCollection';
import { usePigmentInventory } from '@/hooks/usePigmentInventory';
import { UserPigment } from '@/types';
import { formatTimeUntilResetSafe, getCurrentDayIdKSTSafe } from '@/utils/clientOnly';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'map' | 'canvas'>('map');
  const [collectionMessage, setCollectionMessage] = useState('');
  const [showTestingInfo, setShowTestingInfo] = useState(false);
  const [timeUntilReset, setTimeUntilReset] = useState('');
  const [mounted, setMounted] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  
  const { user, signIn } = useAuth();
  const { location, error: locationError, refetch } = useLocation(true);
  const { nearbyCafes, collectibleCafes, dailyStatus } = useCafeCollection(location);
  const { addPigment, inventory, selectedPigment, setSelectedPigment, usePigment, canUsePigment, addPigmentToInventory } = usePigmentInventory();

  // Handle pigment collection from cafe with instant UI update
  const handlePigmentCollected = async (pigment: UserPigment) => {
    // Instantly update UI
    addPigmentToInventory(pigment);
    setCollectionMessage(`Collected ${pigment.name}! 🎨 (${pigment.rarity})`);
    setTimeout(() => setCollectionMessage(''), 5000);
    
    // Background save (non-blocking)
    addPigment(
      pigment.pigmentId,
      pigment.color,
      pigment.name,
      pigment.rarity,
      pigment.collectedFrom
    ).catch(console.error);
  };

  // 色の回数を最大まで回復する機能
  const restoreAllPigments = async () => {
    try {
      // 各色の回数を最大（5回）に設定
      const maxUses = 5;
      
      // 現在の在庫の各色の回数を最大に回復
      const restoredInventory = inventory.map(pigment => ({
        ...pigment,
        usesLeft: maxUses
      }));
      
      // 在庫を更新（UI即座反映）
      // 各色を個別に更新
      restoredInventory.forEach(pigment => {
        addPigmentToInventory(pigment);
      });
      
      setCollectionMessage('All pigments restored to maximum uses! 🎨');
      setTimeout(() => setCollectionMessage(''), 5000);
      
      console.log('Pigments restored to maximum uses:', restoredInventory);
      
    } catch (error) {
      console.error('Failed to restore pigments:', error);
      setCollectionMessage('Failed to restore pigments. Please try again.');
      setTimeout(() => setCollectionMessage(''), 5000);
    }
  };

  // Prevent SSR hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update countdown timer
  useEffect(() => {
    if (!mounted) return;
    
    const updateTimer = () => {
      setTimeUntilReset(formatTimeUntilResetSafe());
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [mounted]);

  // Show error state if initialization failed
  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#E9EACE] to-[#F7F9EF]">
        <div className="text-center p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Application Error</h1>
          <p className="text-gray-700 mb-4">{initError}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-[#4F1412] hover:bg-[#3E100E] text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#E9EACE] to-[#F7F9EF]">
        <div className="text-center p-8">
          <div className="mb-8">
            <div className="flex items-center justify-center space-x-1 mb-6">
              <img 
                src="/app-logo.svg" 
                alt="App Logo" 
                className="h-48 w-48"
              />
              <img 
                src="/main-logo.svg" 
                alt="Urban Pigment Logo" 
                className="h-96 w-auto max-w-none"
                style={{ height: '640px' }}
              />
            </div>
            <p className="text-[#7B8C52]">Discover colors in Seongsu-dong, Seoul</p>
          </div>
          <button
            onClick={signIn}
            className="bg-[#4F1412] hover:bg-[#3E100E] text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Start Exploring
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9EF]">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-60">
            <div className="flex items-center space-x-1">
              <img 
                src="/app-logo.svg" 
                alt="App Logo" 
                className="h-20 w-20"
              />
              <img 
                src="/main-logo.svg" 
                alt="Urban Pigment Logo" 
                className="h-56 w-auto"
              />
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Daily Reset Timer */}
              <div className="flex items-center text-sm text-[#7B8C52]">
                <Clock className="w-4 h-4 mr-1" />
                Reset: {mounted ? timeUntilReset : '--:--:--'}
              </div>
              
              {/* Testing Toggle */}
              <button
                onClick={() => setShowTestingInfo(!showTestingInfo)}
                className="p-2 text-[#B2B582] hover:text-[#7B8C52]"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Testing Info Panel */}
      {showTestingInfo && (
        <div className="bg-[#E9EACE] border-b border-[#D7DBBC] p-4">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-sm font-medium text-[#4F1412] mb-2">Testing Mode Enabled</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[#7B8C52]">
              <div>
                <strong>Location Bypass:</strong> {process.env.NEXT_PUBLIC_BYPASS_LOCATION === 'true' ? 'ON' : 'OFF'}
                <br />
                <strong>Daily Limit Bypass:</strong> {process.env.NEXT_PUBLIC_BYPASS_DAILY_LIMIT === 'true' ? 'ON' : 'OFF'}
                <br />
                <strong>Firebase Disabled:</strong> {process.env.NEXT_PUBLIC_FIREBASE_DISABLED === 'true' ? 'ON' : 'OFF'}
                <br />
                <strong>Default Location:</strong> 37.546011, 127.045591
              </div>
              <div>
                <strong>Current Location:</strong> {location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'Loading...'}
                <br />
                <strong>Nearby Cafes:</strong> {nearbyCafes.length} found
                <br />
                <strong>In Range:</strong> {collectibleCafes.length} cafes
                <br />
                <strong>Daily Collections:</strong> {dailyStatus?.totalCollections || 0}
                <br />
                <strong>Current Inventory:</strong> {inventory.length} pigments
                <br />
                <div className="mt-2 space-y-1">
                  <button
                    onClick={restoreAllPigments}
                    className="w-full bg-[#4F1412] text-white px-3 py-1 rounded text-xs hover:bg-[#3E100E] transition-colors"
                  >
                    Restore All Pigments
                  </button>
                  <button
                    onClick={() => {
                      // Test pigment collection manually
                      const testPigment = {
                        pigmentId: `test-${Date.now()}`,
                        color: '#FF6B6B',
                        name: 'Test Red',
                        rarity: 'common' as const,
                        usesLeft: 5,
                        collectedAt: new Date(),
                        collectedFrom: 'test-cafe'
                      };
                      addPigmentToInventory(testPigment);
                      setCollectionMessage('Test pigment added! 🎨');
                      setTimeout(() => setCollectionMessage(''), 3000);
                    }}
                    className="w-full bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 transition-colors"
                  >
                    Add Test Pigment
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="bg-[#7B8C52] border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center">
                <Coffee className="w-4 h-4 mr-1 text-[#4F1412]" />
                <span className="text-[#4F1412] font-medium">
                  {nearbyCafes.length} cafes nearby
                </span>
              </div>
              <div className="flex items-center">
                <Palette className="w-4 h-4 mr-1 text-[#4F1412]" />
                <span className="text-[#4F1412] font-medium">Inventory: <span className="font-bold text-[#4F1412]">{inventory.length}</span> pigments</span>
              </div>
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-1 text-[#4F1412]" />
                <span className="text-[#4F1412] font-medium">Today: {dailyStatus?.totalCollections || 0} collections</span>
              </div>
            </div>
            
            {collectionMessage && (
              <div className="bg-[#E9EACE] text-[#4F1412] px-3 py-1 rounded-lg text-sm">
                {collectionMessage}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-[#E9EACE] border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('map')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'map'
                  ? 'border-[#4F1412] text-[#4F1412]'
                  : 'border-transparent text-[#4F1412] hover:border-[#E9EACE]'
              }`}
            >
              <Coffee className="w-5 h-5 inline mr-2" />
              Cafe Collection
            </button>
            <button
              onClick={() => setActiveTab('canvas')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'canvas'
                  ? 'border-[#4F1412] text-[#4F1412]'
                  : 'border-transparent text-[#4F1412] hover:border-[#E9EACE]'
              }`}
            >
              <Palette className="w-5 h-5 inline mr-2" />
              r/Place Canvas
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'map' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-medium text-[#365C3B] mb-4">
                Cafe Pigment Collection
              </h2>
              <div className="bg-white rounded-lg shadow">
                <CafeMap
                  center={location || undefined}
                  onPigmentCollected={handlePigmentCollected}
                  className="w-full h-96 rounded-lg"
                />
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-[#F9FAF9] rounded-lg p-6">
              <h3 className="text-lg font-medium text-[#4F1412] mb-2">How to Collect</h3>
              <ul className="text-[#7B8C52] space-y-1 text-sm">
                <li>• Visit cafes (☕) and cafe buses (🚌☕) shown on the map</li>
                <li>• Get within 30 meters to collect pigments</li>
                <li>• Each cafe can only be visited once per day</li>
                <li>• Rarity depends on location, crowd density, and time of day</li>
                <li>• Use collected pigments on the r/Place canvas</li>
                <li>• Collections reset daily at midnight KST</li>
              </ul>
            </div>

            {/* Current Status */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-[#365C3B] mb-4">Collection Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#F7F9EF] rounded-lg p-4">
                  <div className="text-2xl font-bold text-[#4F1412]">{nearbyCafes.length}</div>
                  <div className="text-sm text-[#7B8C52]">Cafes Nearby</div>
                </div>
                <div className="bg-[#F7F9EF] rounded-lg p-4">
                  <div className="text-2xl font-bold text-[#4F1412]">{collectibleCafes.length}</div>
                  <div className="text-sm text-[#7B8C52]">In Collection Range</div>
                </div>
                <div className="bg-[#F7F9EF] rounded-lg p-4">
                  <div className="text-2xl font-bold text-[#4F1412]">{dailyStatus?.totalCollections || 0}</div>
                  <div className="text-sm text-[#7B8C52]">Collected Today ({mounted ? getCurrentDayIdKSTSafe() : '--------'})</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'canvas' && (
          <div className="space-y-6">
            {/* Pigment Inventory */}
            <PigmentPalette 
              inventory={inventory}
              selectedPigment={selectedPigment}
              setSelectedPigment={setSelectedPigment}
              canUsePigment={canUsePigment}
            />
            
            {/* r/Place Canvas */}
            <PlaceCanvas 
              selectedPigment={selectedPigment}
              usePigment={usePigment}
              canUsePigment={canUsePigment}
            />
            
            {/* Debug Info */}
            <div className="bg-[#F7F9EF] p-4 rounded text-sm">
              <h4 className="text-[#4F1412] font-medium">Debug Info:</h4>
              <p>Active Tab: {activeTab}</p>
              <p>User: {user?.uid}</p>
              <p>Selected Pigment: {selectedPigment?.name || 'None'}</p>
              <p>Inventory Count: {inventory.length}</p>
            </div>
          </div>
        )}
      </main>

      {/* Location Error */}
      {locationError && (
        <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Location Error:</strong> {locationError}
          <button
            onClick={refetch}
            className="ml-2 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* No longer needed - loading handled by components */}
    </div>
  );
}
