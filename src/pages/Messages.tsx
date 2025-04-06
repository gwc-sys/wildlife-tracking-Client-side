import { useEffect, useState } from 'react';
import { database } from './firebaseDatabaseConfig';
import { ref, onValue, off } from 'firebase/database';

interface MotionData {
  status?: string;
  timestamp?: number;
}

interface LocationData {
  lat?: number;
  lng?: number;
  accuracy?: number;
  timestamp?: number;
}

interface AlertData {
  message?: string;
  severity?: 'low' | 'medium' | 'high';
  timestamp?: number;
}

export default function DeviceMonitor() {
  const [deviceId, setDeviceId] = useState<string>('-OMxlruhcnBp92AAkV05');
  const [currentMotion, setCurrentMotion] = useState<MotionData | null>(null);
  const [motionHistory, setMotionHistory] = useState<Record<string, MotionData>>({});
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check Firebase connection
  useEffect(() => {
    const connectedRef = ref(database, '.info/connected');
    const connectionUnsubscribe = onValue(connectedRef, (snapshot) => {
      setIsConnected(snapshot.val() === true);
    });

    return () => off(connectedRef);
  }, []);

  // Main data listeners
  useEffect(() => {
    if (!isConnected) return;

    setLoading(true);
    setError(null);

    const motionLastRef = ref(database, `devices/${deviceId}/motion_status/last`);
    const motionHistoryRef = ref(database, `devices/${deviceId}/motion_status/history`);
    const locationRef = ref(database, `devices/${deviceId}/locations/last_known`);

    const motionLastUnsubscribe = onValue(
      motionLastRef,
      (snapshot) => {
        setCurrentMotion(snapshot.val());
        setLoading(false);
      },
      (error) => {
        setError(`Motion error: ${error.message}`);
        setLoading(false);
      }
    );

    const motionHistoryUnsubscribe = onValue(
      motionHistoryRef,
      (snapshot) => setMotionHistory(snapshot.val() || {}),
      (error) => setError(`Motion history error: ${error.message}`)
    );

    const locationUnsubscribe = onValue(
      locationRef,
      (snapshot) => setCurrentLocation(snapshot.val()),
      (error) => setError(`Location error: ${error.message}`)
    );

    return () => {
      off(motionLastRef);
      off(motionHistoryRef);
      off(locationRef);
    };
  }, [deviceId, isConnected]);

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return 'Unknown time';
    return new Date(timestamp).toLocaleString();
  };

  const renderMotionStatus = () => {
    if (loading) return <div className="text-gray-500">Loading...</div>;
    if (!currentMotion) return <div className="text-gray-500">No motion data</div>;
    
    const isMotion = currentMotion.status?.includes("Detected");
    return (
      <div className={`p-4 rounded-lg ${isMotion ? 'bg-red-100' : 'bg-green-100'} border ${isMotion ? 'border-red-300' : 'border-green-300'}`}>
        <div className="flex items-center">
          <span className={`text-2xl mr-2 ${isMotion ? 'text-red-600' : 'text-green-600'}`}>
            {isMotion ? '🚨' : '✅'}
          </span>
          <div>
            <h3 className="font-bold">{currentMotion.status || 'Unknown status'}</h3>
            <p className="text-sm text-gray-600">{formatTimestamp(currentMotion.timestamp)}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderLocation = () => {
    if (loading) return <div className="text-gray-500">Loading...</div>;
    if (!currentLocation || (currentLocation.lat === 0 && currentLocation.lng === 0)) {
      return <div className="text-gray-500">No location data</div>;
    }
    
    return (
      <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
        <div className="flex items-center">
          <span className="text-2xl mr-2 text-blue-600">📍</span>
          <div>
            <h3 className="font-bold">
              {currentLocation.lat?.toFixed(6)}, {currentLocation.lng?.toFixed(6)}
            </h3>
            <p className="text-sm text-gray-600">
              Accuracy: {currentLocation.accuracy} meters<br />
              {formatTimestamp(currentLocation.timestamp)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderMotionHistory = () => {
    if (loading) return <div className="text-gray-500">Loading...</div>;
    if (Object.keys(motionHistory).length === 0) return <div className="text-gray-500">No history data</div>;
    
    return (
      <div className="space-y-3">
        {Object.entries(motionHistory)
          .sort(([,a], [,b]) => (b.timestamp || 0) - (a.timestamp || 0))
          .slice(0, 5)
          .map(([id, motion]) => (
            <div key={id} className="p-3 bg-gray-50 rounded border border-gray-200">
              <div className="flex justify-between">
                <span className={`font-medium ${motion.status?.includes("Detected") ? 'text-red-600' : 'text-green-600'}`}>
                  {motion.status}
                </span>
                <span className="text-xs text-gray-500">
                  {formatTimestamp(motion.timestamp)}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-1">ID: {id.substring(0, 8)}</div>
            </div>
          ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Device Monitoring Dashboard</h1>
          <div className="flex items-center mt-2">
            <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected to Firebase' : 'Disconnected'}
            </span>
          </div>
        </header>

        <div className="mb-6 bg-white p-4 rounded-lg shadow">
          <label className="block text-sm font-medium text-gray-700 mb-1">Device ID</label>
          <input
            type="text"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter device ID"
          />
        </div>

        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded">
            <p>{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Motion Status Card */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Motion Detection</h2>
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3 text-gray-700">Current Status</h3>
              {renderMotionStatus()}
            </div>
            <div>
              <h3 className="text-lg font-medium mb-3 text-gray-700">Recent History</h3>
              {renderMotionHistory()}
            </div>
          </div>

          {/* Location Card */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Location Tracking</h2>
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3 text-gray-700">Current Location</h3>
              {renderLocation()}
            </div>
            <div>
              <h3 className="text-lg font-medium mb-3 text-gray-700">Device Information</h3>
              <div className="p-4 bg-gray-50 rounded border border-gray-200">
                <p className="text-gray-700">Device ID: <span className="font-mono">{deviceId}</span></p>
                <p className="text-gray-700 mt-2">Last updated: {currentMotion?.timestamp ? formatTimestamp(currentMotion.timestamp) : 'Unknown'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">System Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded border border-green-200">
              <h3 className="font-medium text-green-800">Firebase Connection</h3>
              <p className="text-sm text-green-600 mt-1">
                {isConnected ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded border border-blue-200">
              <h3 className="font-medium text-blue-800">Data Freshness</h3>
              <p className="text-sm text-blue-600 mt-1">
                {currentMotion?.timestamp ? `${Math.floor((Date.now() - currentMotion.timestamp) / 1000)} seconds ago` : 'Unknown'}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded border border-purple-200">
              <h3 className="font-medium text-purple-800">Motion Events</h3>
              <p className="text-sm text-purple-600 mt-1">
                {Object.keys(motionHistory).length} recorded
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}