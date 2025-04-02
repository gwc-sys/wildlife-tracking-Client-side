import { useEffect, useState, useCallback } from 'react';
import { database } from './firebaseDatabaseConfig';
import { ref, onValue, off, query, limitToLast, orderByKey } from 'firebase/database';
import { GoogleMap, Marker, Polyline, useLoadScript } from '@react-google-maps/api';

interface LocationData {
  accuracy: number;
  lat: number;
  lng: number;
  timestamp?: number;
}

const mapContainerStyle = {
  width: '100%',
  height: '400px'
};

const defaultCenter = {
  lat: 0,
  lng: 0
};

export default function LocationTrackerWithMap() {
  const [currentLocation, setCurrentLocation] = useState<{id: string, data: LocationData} | null>(null);
  const [history, setHistory] = useState<{id: string, data: LocationData}[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [travelPath, setTravelPath] = useState<{lat: number, lng: number}[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingHistory, setTrackingHistory] = useState<{id: string, path: {lat: number, lng: number}[], startTime: number, endTime: number}[]>([]);

  // Debugging logs
  console.log('Current state:', {
    currentLocation,
    history: history.length,
    travelPath: travelPath.length,
    trackingHistory: trackingHistory.length,
    error
  });

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: 'AIzaSyD1AU417WvKaz4_LT5B2hrWPuCypMVjio0'
    
  });
  console.log('Google Maps API Key:', process.env.REACT_APP_GOOGLE_MAPS_API_KEY);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
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
          startTime: travelPath[0] ? Number(Object.keys(travelPath[0])[0]) : Date.now(),
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
          startTime: travelPath[0] ? Number(Object.keys(travelPath[0])[0]) : Date.now(),
          endTime: Date.now()
        }
      ]);
      setTravelPath([]);
    }
  };

  const panToCurrentLocation = useCallback(() => {
    if (map && currentLocation) {
      map.panTo({ lat: currentLocation.data.lat, lng: currentLocation.data.lng });
    }
  }, [map, currentLocation]);

  useEffect(() => {
    if (isTracking && currentLocation) {
      setTravelPath(prev => [
        ...prev,
        { lat: currentLocation.data.lat, lng: currentLocation.data.lng }
      ]);
    }
  }, [currentLocation, isTracking]);

  useEffect(() => {
    console.log('Initializing Firebase listeners');
    const locationRef = ref(database, 'device_001/locations');

    const historyQuery = query(
      locationRef,
      orderByKey(),
      limitToLast(50)
    );

    const historyUnsubscribe = onValue(
      historyQuery,
      (snapshot) => {
        try {
          console.log('Received history data', snapshot.val());
          const historicalData: {id: string, data: LocationData}[] = [];
          
          snapshot.forEach((childSnapshot) => {
            const locationData = childSnapshot.val();
            if (locationData && typeof locationData === 'object') {
              historicalData.push({
                id: childSnapshot.key || `fallback-${Date.now()}`,
                data: {
                  accuracy: locationData.accuracy || 0,
                  lat: locationData.lat || 0,
                  lng: locationData.lng || 0,
                  timestamp: Number(childSnapshot.key) || Date.now()
                }
              });
            }
          });

          setHistory(historicalData.reverse());
          setError(null);
        } catch (error) {
          console.error('History error:', error);
          setError(`Failed to load history: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },
      (error) => {
        console.error('History listener error:', error);
        setError(`History error: ${error.message}`);
      }
    );

    const realtimeUnsubscribe = onValue(
      locationRef,
      (snapshot) => {
        try {
          console.log('Received realtime update', snapshot.val());
          let latestLocation: {id: string, data: LocationData} | null = null;
          
          snapshot.forEach((childSnapshot) => {
            const locationData = childSnapshot.val();
            if (locationData && typeof locationData === 'object') {
              latestLocation = {
                id: childSnapshot.key || `realtime-${Date.now()}`,
                data: {
                  accuracy: locationData.accuracy || 0,
                  lat: locationData.lat || 0,
                  lng: locationData.lng || 0,
                  timestamp: Number(childSnapshot.key) || Date.now()
                }
              };
            }
          });

          if (latestLocation) {
            setCurrentLocation(latestLocation);
            setHistory(prev => {
              const exists = prev.some(item => item.id === latestLocation?.id);
              return exists ? prev : [latestLocation!, ...prev.slice(0, 49)];
            });
            setError(null);
          }
        } catch (error) {
          console.error('Realtime error:', error);
          setError(`Failed to process update: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },
      (error) => {
        console.error('Realtime listener error:', error);
        setError(`Realtime error: ${error.message}`);
      }
    );

    return () => {
      console.log('Cleaning up Firebase listeners');
      off(historyQuery);
      off(locationRef);
    };
  }, []);

  const onLoad = useCallback((map: google.maps.Map) => {
    console.log('Map loaded');
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
      map.setZoom(2);
    }
  }, [currentLocation, history]);

  if (loadError) {
    console.error('Google Maps load error:', loadError);
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Map Loading Error</h1>
        <p className="mt-2 text-red-700">{loadError.message}</p>
        <p className="mt-4">Please check your Google Maps API key and network connection</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-blue-600">Loading Map...</h1>
        <p className="mt-2 animate-pulse">Please wait while we load the map</p>
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
              zoom={currentLocation ? 15 : 2}
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
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-500">Last Updated</p>
                <p className="text-gray-700">
                  {formatTime(currentLocation.data.timestamp || Number(currentLocation.id))}
                </p>
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
              <p className="text-yellow-700">Waiting for location data...</p>
            </div>
          )}
        </div>

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
                      <p className="text-xs">{new Date(track.startTime).toLocaleTimeString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">End</p>
                      <p className="text-xs">{new Date(track.endTime).toLocaleTimeString()}</p>
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

        {/* Location History Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Location History</h2>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {history.length > 0 ? (
              <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {history.map((location) => (
                  <li key={location.id} className="p-4 hover:bg-gray-50">
                    <div className="grid grid-cols-3 gap-2">
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
                        <p className="text-xs text-gray-500">Time</p>
                        <p className="text-xs">
                          {formatTime(location.data.timestamp || Number(location.id))}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-gray-500">
                {error ? "Error loading history" : "No location history available"}
              </div>
            )}
          </div>
        </div>

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