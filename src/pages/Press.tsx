import { useEffect, useState, useCallback, useMemo } from 'react';
import { database } from './firebaseDatabaseConfig';
import { ref, onValue, off, query, limitToLast, orderByChild } from 'firebase/database';
import { GoogleMap, Marker, Polyline, useLoadScript } from '@react-google-maps/api';

interface LocationData {
  accuracy: number;
  lat: number;
  lng: number;
  source: string;
  timestamp: number;
}

interface AlertData {
  status: string;
  timestamp: number;
  source: string;
}

interface DeviceData {
  id: string;
  locations: { [key: string]: LocationData };
  alerts: { [key: string]: AlertData };
}

const mapContainerStyle = {
  width: '100%',
  height: '400px'
};

const defaultCenter = {
  lat: 18.67786,
  lng: 73.84219
};

export default function DeviceLocationTracker() {
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationData[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [travelPath, setTravelPath] = useState<{lat: number, lng: number}[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ,
    libraries: ['places'] // Add any additional libraries you need
  });

  const formatTime = useCallback((timestamp: number) => {
    const adjustedTimestamp = timestamp > 1e12 ? timestamp / 1000 : timestamp;
    return new Date(adjustedTimestamp).toLocaleString();
  }, []);

  const formatCoordinates = useCallback((lat: number, lng: number) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }, []);

  const toggleTracking = useCallback(() => {
    if (isTracking) {
      setTravelPath([]);
    }
    setIsTracking(prev => !prev);
  }, [isTracking]);

  const panToCurrentLocation = useCallback(() => {
    if (map && currentLocation) {
      map.panTo({ lat: currentLocation.lat, lng: currentLocation.lng });
      map.setZoom(15);
    }
  }, [map, currentLocation]);

  const deviceOptions = useMemo(() => (
    devices.map((device) => (
      <option key={device.id} value={device.id}>
        Device {device.id.substring(0, 8)}...
      </option>
    ))
  ), [devices]);

  // Effect for tracking path updates
  useEffect(() => {
    if (isTracking && currentLocation) {
      setTravelPath(prev => [
        ...prev,
        { lat: currentLocation.lat, lng: currentLocation.lng }
      ]);
    }
  }, [currentLocation, isTracking]);

  // Effect for fetching devices
  useEffect(() => {
    const devicesRef = ref(database, 'devices');
    
    const handleSnapshot = (snapshot: any) => {
      try {
        if (!snapshot.exists()) {
          setError('No devices found in database');
          setIsLoading(false);
          return;
        }

        const devicesData: DeviceData[] = [];
        snapshot.forEach((deviceSnapshot: any) => {
          const deviceId = deviceSnapshot.key;
          const deviceData = deviceSnapshot.val();
          
          if (deviceId && deviceData) {
            devicesData.push({
              id: deviceId,
              locations: deviceData.locations || {},
              alerts: deviceData.alerts || {}
            });
          }
        });

        setDevices(devicesData);
        
        if (devicesData.length > 0 && !selectedDevice) {
          setSelectedDevice(devicesData[0].id);
        }
        
        setError(null);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching devices:', error);
        setError(`Failed to load devices: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    const handleError = (error: any) => {
      console.error('Devices listener error:', error);
      setError(`Devices error: ${error.message}`);
      setIsLoading(false);
    };

    const unsubscribe = onValue(devicesRef, handleSnapshot, handleError);

    return () => {
      off(devicesRef, 'value', unsubscribe);
    };
  }, [selectedDevice]);

  // Effect for fetching device data when selected device changes
  useEffect(() => {
    if (!selectedDevice) return;

    setIsLoading(true);
    
    // References
    const locationRef = ref(database, `devices/${selectedDevice}/locations`);
    const alertsRef = ref(database, `devices/${selectedDevice}/alerts`);
    
    // Queries
    const locationQuery = query(locationRef, orderByChild('timestamp'), limitToLast(1));
    const historyQuery = query(locationRef, orderByChild('timestamp'), limitToLast(50));
    const alertsQuery = query(alertsRef, orderByChild('timestamp'), limitToLast(10));

    // Current location handler
    const handleLocationSnapshot = (snapshot: any) => {
      try {
        if (!snapshot.exists()) {
          setCurrentLocation(null);
          return;
        }

        snapshot.forEach((childSnapshot: any) => {
          const location = childSnapshot.val();
          if (location) {
            setCurrentLocation(location);
          }
        });
      } catch (error) {
        console.error('Location error:', error);
        setError(`Failed to load location: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    // History handler
    const handleHistorySnapshot = (snapshot: any) => {
      try {
        const history: LocationData[] = [];
        
        snapshot.forEach((childSnapshot: any) => {
          const location = childSnapshot.val();
          if (location) {
            history.push(location);
          }
        });

        history.sort((a, b) => b.timestamp - a.timestamp);
        setLocationHistory(history);
        setIsLoading(false);
      } catch (error) {
        console.error('History error:', error);
        setError(`Failed to load history: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    // Alerts handler
    const handleAlertsSnapshot = (snapshot: any) => {
      try {
        const alertsData: AlertData[] = [];
        
        snapshot.forEach((childSnapshot: any) => {
          const alert = childSnapshot.val();
          if (alert) {
            alertsData.push(alert);
          }
        });

        alertsData.sort((a, b) => b.timestamp - a.timestamp);
        setAlerts(alertsData);
      } catch (error) {
        console.error('Alerts error:', error);
        setError(`Failed to load alerts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    // Subscribe to all listeners
    const locationUnsubscribe = onValue(locationQuery, handleLocationSnapshot);
    const historyUnsubscribe = onValue(historyQuery, handleHistorySnapshot);
    const alertsUnsubscribe = onValue(alertsQuery, handleAlertsSnapshot);

    return () => {
      off(locationQuery, 'value', locationUnsubscribe);
      off(historyQuery, 'value', historyUnsubscribe);
      off(alertsQuery, 'value', alertsUnsubscribe);
    };
  }, [selectedDevice]);

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
    const bounds = new window.google.maps.LatLngBounds();
    
    if (currentLocation) {
      bounds.extend(new window.google.maps.LatLng(currentLocation.lat, currentLocation.lng));
    }
    
    locationHistory.forEach(loc => {
      bounds.extend(new window.google.maps.LatLng(loc.lat, loc.lng));
    });
    
    if (locationHistory.length > 0 || currentLocation) {
      mapInstance.fitBounds(bounds);
    } else {
      mapInstance.setCenter(defaultCenter);
      mapInstance.setZoom(12);
    }
  }, [currentLocation, locationHistory]);

  if (loadError) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Map Loading Error</h1>
        <p className="mt-2 text-red-700">Failed to load Google Maps. Please check your API key.</p>
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

        {/* Device Selection */}
        <div className="mb-6">
          <label htmlFor="device-select" className="block text-sm font-medium text-gray-700 mb-2">
            Select Device
          </label>
          <select
            id="device-select"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            value={selectedDevice || ''}
            onChange={(e) => setSelectedDevice(e.target.value)}
          >
            <option value="">Select a device</option>
            {deviceOptions}
          </select>
        </div>

        {/* Map Section */}
        <div className="bg-gray-50 p-4 rounded-lg shadow-md mb-8">
          <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
            <h2 className="text-xl font-semibold text-gray-800">
              {selectedDevice ? `Device ${selectedDevice.substring(0, 8)}...` : 'Live Location'}
            </h2>
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
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={currentLocation ? { 
                lat: currentLocation.lat, 
                lng: currentLocation.lng 
              } : defaultCenter}
              zoom={currentLocation ? 15 : 12}
              onLoad={onLoad}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
                controlSize: 24
              }}
            >
              {currentLocation && (
                <Marker
                  position={{ 
                    lat: currentLocation.lat, 
                    lng: currentLocation.lng 
                  }}
                  icon={{
                    url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                    scaledSize: new window.google.maps.Size(40, 40)
                  }}
                />
              )}

              {locationHistory.map((location, index) => (
                <Marker
                  key={`history-${location.timestamp}-${index}`}
                  position={{ lat: location.lat, lng: location.lng }}
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
            </GoogleMap>
          </div>
        </div>

        {/* Current Location Section */}
        {selectedDevice && (
          <div className="bg-gray-50 p-6 rounded-lg shadow-md mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Current Location Details</h2>
            {currentLocation ? (
              <div className="bg-white p-4 rounded-md border border-blue-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Coordinates</p>
                    <p className="text-lg font-mono text-blue-700">
                      {formatCoordinates(currentLocation.lat, currentLocation.lng)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Accuracy</p>
                    <p className="text-lg text-blue-700">
                      ±{currentLocation.accuracy} meters
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Source</p>
                    <p className="text-lg text-blue-700">
                      {currentLocation.source || 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Last Updated</p>
                    <p className="text-lg text-blue-700">
                      {formatTime(currentLocation.timestamp)}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <a
                    href={`https://www.google.com/maps?q=${currentLocation.lat},${currentLocation.lng}`}
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
                <p className="text-yellow-700">No current location data available for this device</p>
              </div>
            )}
          </div>
        )}

        {/* Location History Section */}
        {selectedDevice && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Location History</h2>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {locationHistory.length > 0 ? (
                <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                  {locationHistory.map((location, index) => (
                    <li key={`loc-${location.timestamp}-${index}`} className="p-4 hover:bg-gray-50">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Coordinates</p>
                          <p className="text-sm font-mono">
                            {formatCoordinates(location.lat, location.lng)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Accuracy</p>
                          <p className="text-sm">±{location.accuracy}m</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Source</p>
                          <p className="text-sm">{location.source || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Time</p>
                          <p className="text-sm">
                            {formatTime(location.timestamp)}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  No location history available for this device
                </div>
              )}
            </div>
          </div>
        )}

        {/* Alerts Section */}
        {selectedDevice && alerts.length > 0 && (
          <div className="bg-gray-50 p-6 rounded-lg shadow-md mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Alerts</h2>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {alerts.map((alert, index) => (
                  <li key={`alert-${alert.timestamp}-${index}`} className="p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-red-600">{alert.status}</p>
                        <p className="text-sm text-gray-500">{formatTime(alert.timestamp)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Source: {alert.source || 'Unknown'}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
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