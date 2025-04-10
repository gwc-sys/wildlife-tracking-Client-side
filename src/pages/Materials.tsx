import { useEffect, useState, useCallback } from 'react';
import { database } from './firebaseDatabaseConfig';
import { ref, onValue, off, query, limitToLast, orderByChild } from 'firebase/database';
import { GoogleMap, Marker, Polyline, useLoadScript } from '@react-google-maps/api';

interface LocationData {
  accuracy: number;
  lat: number;
  lng: number;
  source?: string;
  timestamp: number;
}

interface AlertData {
  status: string;
  timestamp: number;
  source?: string;
}

const mapContainerStyle = {
  width: '100%',
  height: '400px'
};

const defaultCenter = {
  lat: 18.67786,
  lng: 73.84219
};

export default function LocationTrackerWithMap() {
  const [currentLocation, setCurrentLocation] = useState<{id: string, data: LocationData} | null>(null);
  const [history, setHistory] = useState<{id: string, data: LocationData}[]>([]);
  const [alerts, setAlerts] = useState<{id: string, data: AlertData}[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [travelPath, setTravelPath] = useState<{
    timestamp: number;lat: number, lng: number
}[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingHistory, setTrackingHistory] = useState<{id: string, path: {lat: number, lng: number}[], startTime: number, endTime: number}[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  });

  const formatTime = (timestamp: number) => {
    const adjustedTimestamp = timestamp > 1e12 ? timestamp / 1000 : timestamp;
    return new Date(adjustedTimestamp).toLocaleString();
  };

  const formatCoordinates = (lat: number, lng: number) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  const toggleTracking = () => {
    if (isTracking) {
      setTrackingHistory(prev => [
        ...prev,
        {
          id: `track-${Date.now()}`,
          path: [...travelPath],
          startTime: travelPath[0]?.timestamp || Date.now(),
          endTime: Date.now()
        }
      ]);
      setTravelPath([]);
    }
    setIsTracking(!isTracking);
  };

  const saveCurrentPath = () => {
    if (travelPath.length > 0) {
      setTrackingHistory(prev => [
        ...prev,
        {
          id: `track-${Date.now()}`,
          path: [...travelPath],
          startTime: travelPath[0]?.timestamp || Date.now(),
          endTime: Date.now()
        }
      ]);
      setTravelPath([]);
    }
  };

  const panToCurrentLocation = useCallback(() => {
    if (map && currentLocation) {
      map.panTo({ lat: currentLocation.data.lat, lng: currentLocation.data.lng });
      map.setZoom(15);
    }
  }, [map, currentLocation]);

  useEffect(() => {
    if (isTracking && currentLocation) {
      setTravelPath(prev => [
        ...prev,
        { 
          lat: currentLocation.data.lat, 
          lng: currentLocation.data.lng,
          timestamp: currentLocation.data.timestamp 
        }
      ]);
    }
  }, [currentLocation, isTracking]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Locations reference
        const locationsRef = ref(database, 'locations');
        const locationsQuery = query(
          locationsRef,
          orderByChild('timestamp'),
          limitToLast(50)
        );

        // Alerts reference
        const alertsRef = ref(database, 'alerts');
        const alertsQuery = query(
          alertsRef,
          orderByChild('timestamp'),
          limitToLast(10)
        );

        const locationsUnsubscribe = onValue(
          locationsQuery,
          (snapshot) => {
            try {
              if (!snapshot.exists()) {
                console.log('No location data available');
                setHistory([]);
                setIsLoading(false);
                return;
              }

              const locationsData: {id: string, data: LocationData}[] = [];
              
              snapshot.forEach((childSnapshot) => {
                const locationData = childSnapshot.val();
                if (locationData && typeof locationData === 'object') {
                  locationsData.push({
                    id: childSnapshot.key || `loc-${Date.now()}`,
                    data: {
                      accuracy: locationData.accuracy || 0,
                      lat: locationData.lat || 0,
                      lng: locationData.lng || 0,
                      source: locationData.source || 'Unknown',
                      timestamp: locationData.timestamp || Date.now()
                    }
                  });
                }
              });

              // Sort by timestamp (newest first)
              locationsData.sort((a, b) => b.data.timestamp - a.data.timestamp);
              
              setHistory(locationsData);
              
              // Set current location to the most recent one
              if (locationsData.length > 0) {
                setCurrentLocation(locationsData[0]);
              }
              
              setError(null);
              setIsLoading(false);
            } catch (error) {
              console.error('Locations error:', error);
              setError(`Failed to load locations: ${error instanceof Error ? error.message : 'Unknown error'}`);
              setIsLoading(false);
            }
          },
          (error) => {
            console.error('Locations listener error:', error);
            setError(`Locations error: ${error.message}`);
            setIsLoading(false);
          }
        );

        const alertsUnsubscribe = onValue(
          alertsQuery,
          (snapshot) => {
            try {
              if (!snapshot.exists()) {
                console.log('No alert data available');
                setAlerts([]);
                return;
              }

              const alertsData: {id: string, data: AlertData}[] = [];
              
              snapshot.forEach((childSnapshot) => {
                const alertData = childSnapshot.val();
                if (alertData && typeof alertData === 'object') {
                  alertsData.push({
                    id: childSnapshot.key || `alert-${Date.now()}`,
                    data: {
                      status: alertData.status || 'Unknown',
                      source: alertData.source || 'Unknown',
                      timestamp: alertData.timestamp || Date.now()
                    }
                  });
                }
              });

              // Sort by timestamp (newest first)
              alertsData.sort((a, b) => b.data.timestamp - a.data.timestamp);
              
              setAlerts(alertsData);
              setError(null);
            } catch (error) {
              console.error('Alerts error:', error);
              setError(`Failed to load alerts: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          },
          (error) => {
            console.error('Alerts listener error:', error);
            setError(`Alerts error: ${error.message}`);
          }
        );

        return () => {
          off(locationsRef);
          off(alertsRef);
        };
      } catch (error) {
        console.error('Initialization error:', error);
        setError(`Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    const bounds = new window.google.maps.LatLngBounds();
    
    if (currentLocation) {
      bounds.extend(new window.google.maps.LatLng(currentLocation.data.lat, currentLocation.data.lng));
    }
    
    history.forEach(loc => {
      bounds.extend(new window.google.maps.LatLng(loc.data.lat, loc.data.lng));
    });
    
    if (history.length > 0 || currentLocation) {
      map.fitBounds(bounds);
    } else {
      map.setCenter(defaultCenter);
      map.setZoom(12);
    }
  }, [currentLocation, history]);

  if (loadError) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Map Loading Error</h1>
        <p className="mt-2 text-red-700">{loadError.message}</p>
      </div>
    );
  }

  if (!isLoaded || isLoading) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-blue-600">Loading...</h1>
        <p className="mt-2 animate-pulse">Please wait while we load the data</p>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Device Location Tracker</h1>
          <p className="mt-2 text-lg text-gray-600">Real-time tracking with Google Maps</p>
        </div>

        {/* Map Section */}
        <div className="bg-gray-50 p-4 rounded-lg shadow-md mb-8">
          <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
            <h2 className="text-xl font-semibold text-gray-800">Live Location</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={panToCurrentLocation}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                disabled={!currentLocation}
              >
                Center Map
              </button>
              <button
                onClick={toggleTracking}
                className={`px-4 py-2 rounded text-white ${
                  isTracking ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isTracking ? 'Stop Tracking' : 'Start Tracking'}
              </button>
              {isTracking && travelPath.length > 0 && (
                <button
                  onClick={saveCurrentPath}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Save Path
                </button>
              )}
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={currentLocation ? { 
                lat: currentLocation.data.lat, 
                lng: currentLocation.data.lng 
              } : defaultCenter}
              zoom={currentLocation ? 15 : 12}
              onLoad={onLoad}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false
              }}
            >
              {currentLocation && (
                <Marker
                  position={{ 
                    lat: currentLocation.data.lat, 
                    lng: currentLocation.data.lng 
                  }}
                  icon={{
                    url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                    scaledSize: new window.google.maps.Size(40, 40)
                  }}
                />
              )}

              {history.map((location) => (
                <Marker
                  key={`history-${location.id}`}
                  position={{ lat: location.data.lat, lng: location.data.lng }}
                  icon={{
                    url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
                    scaledSize: new window.google.maps.Size(20, 20)
                  }}
                  opacity={0.7}
                />
              ))}

              {travelPath.length > 1 && (
                <Polyline
                  path={travelPath}
                  options={{
                    strokeColor: '#FF0000',
                    strokeOpacity: 1.0,
                    strokeWeight: 3
                  }}
                />
              )}

              {trackingHistory.map((track) => (
                <Polyline
                  key={`track-${track.id}`}
                  path={track.path}
                  options={{
                    strokeColor: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`,
                    strokeOpacity: 0.7,
                    strokeWeight: 2
                  }}
                />
              ))}
            </GoogleMap>
          </div>
        </div>

        {/* Current Location Section */}
        <div className="bg-gray-50 p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Current Location Details</h2>
          {currentLocation ? (
            <div className="bg-white p-4 rounded-md border border-blue-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Coordinates</p>
                  <p className="text-lg font-mono text-blue-700">
                    {formatCoordinates(currentLocation.data.lat, currentLocation.data.lng)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Accuracy</p>
                  <p className="text-lg text-blue-700">
                    ±{currentLocation.data.accuracy} meters
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Source</p>
                  <p className="text-lg text-blue-700">
                    {currentLocation.data.source || 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Last Updated</p>
                  <p className="text-lg text-blue-700">
                    {formatTime(currentLocation.data.timestamp)}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <a
                  href={`https://www.google.com/maps?q=${currentLocation.data.lat},${currentLocation.data.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                >
                  Open in Google Maps
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
              <p className="text-yellow-700">No current location data available</p>
            </div>
          )}
        </div>

        {/* Location History Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Location History</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {history.length > 0 ? (
              <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {history.map((location) => (
                  <li key={location.id} className="p-4 hover:bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Coordinates</p>
                        <p className="text-sm font-mono">
                          {formatCoordinates(location.data.lat, location.data.lng)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Accuracy</p>
                        <p className="text-sm">±{location.data.accuracy}m</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Source</p>
                        <p className="text-sm">{location.data.source || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Time</p>
                        <p className="text-sm">
                          {formatTime(location.data.timestamp)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-gray-500">
                No location history available
              </div>
            )}
          </div>
        </div>

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <div className="bg-gray-50 p-6 rounded-lg shadow-md mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Alerts</h2>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {alerts.map((alert) => (
                  <li key={alert.id} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-red-600">{alert.data.status}</p>
                        <p className="text-sm text-gray-500">{formatTime(alert.data.timestamp)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Source: {alert.data.source || 'Unknown'}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Tracking History Section */}
        {trackingHistory.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Saved Paths</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trackingHistory.map((track) => (
                <div key={track.id} className="bg-white p-4 rounded-md border border-purple-200 shadow-sm">
                  <h3 className="font-medium text-purple-700">Path {track.id.slice(-4)}</h3>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <p className="text-xs text-gray-500">Points</p>
                      <p className="text-sm">{track.path.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Duration</p>
                      <p className="text-sm">
                        {Math.round((track.endTime - track.startTime) / 1000)} sec
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <p className="text-xs text-gray-500">Start</p>
                      <p className="text-xs">{formatTime(track.startTime)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">End</p>
                      <p className="text-xs">{formatTime(track.endTime)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (map) {
                        const bounds = new window.google.maps.LatLngBounds();
                        track.path.forEach(point => {
                          bounds.extend(new window.google.maps.LatLng(point.lat, point.lng));
                        });
                        map.fitBounds(bounds);
                      }
                    }}
                    className="mt-2 text-xs text-purple-600 hover:text-purple-800 underline"
                  >
                    Show on map
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}