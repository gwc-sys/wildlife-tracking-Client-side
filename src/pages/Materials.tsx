import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { database } from './firebaseDatabaseConfig';
import { ref, onValue, off, query, limitToLast, orderByChild } from 'firebase/database';
import { GoogleMap, Marker, Polyline, useLoadScript } from '@react-google-maps/api';
import { 
  FaExpand, FaCompress, FaMapMarkerAlt, FaSatellite, FaShare, 
  FaSearchLocation, FaRoute, FaHistory, FaBell, FaInfoCircle,
  FaPlus, FaMinus, FaStreetView, FaLayerGroup, FaClock
} from 'react-icons/fa';
import { MdMyLocation, MdSpeed, MdDirectionsCar } from 'react-icons/md';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface LocationData {
  accuracy?: number;
  lat?: number;
  lng?: number;
  source?: string;
  timestamp?: number;
  speed?: number;
  battery?: number;
}

interface AlertData {
  status?: string;
  timestamp?: number;
  source?: string;
  type?: string;
  message?: string;
}

interface DeviceData {
  id: string;
  name?: string;
  type?: string;
  locations?: { [key: string]: LocationData };
  alerts?: { [key: string]: AlertData };
  status?: string;
}

const mapContainerStyle = {
  width: '100%',
  height: '70vh'
};

const defaultCenter = {
  lat: 18.67786,
  lng: 73.84219
};

const isValidLocation = (location: any): location is LocationData => 
  location && typeof location.lat === 'number' && typeof location.lng === 'number';

const isValidAlert = (alert: any): alert is AlertData =>
  alert && typeof alert.status === 'string' && typeof alert.timestamp === 'number';

export default function DeviceLocationTracker() {
  // State management
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [myLocation, setMyLocation] = useState<LocationData | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationData[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [travelPath, setTravelPath] = useState<{lat: number, lng: number}[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'location' | 'history' | 'alerts'>('location');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState(15);
  const [showStreetView, setShowStreetView] = useState(false);
  const [selectedHistoryPoint, setSelectedHistoryPoint] = useState<LocationData | null>(null);
  const [speedUnit, setSpeedUnit] = useState<'kmh' | 'mph'>('kmh');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showMyLocation, setShowMyLocation] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places', 'geometry', 'visualization']
  });

  // Get current user's location
  const getMyLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed ?? undefined,
            timestamp: Date.now(),
            source: 'browser'
          };
          setMyLocation(newLocation);
          
          // Update address if this is the first time or significant movement
          if (!myLocation || 
              google.maps.geometry.spherical.computeDistanceBetween(
                new google.maps.LatLng(newLocation.lat, newLocation.lng),
                new google.maps.LatLng(myLocation.lat || 0, myLocation.lng || 0)
              ) > 50) {
            reverseGeocode(newLocation.lat, newLocation.lng);
          }
        },
        (error) => {
          toast.error(`Geolocation error: ${error.message}`);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 5000
        }
      );
    } else {
      toast.error("Geolocation is not supported by this browser");
    }
  }, [myLocation]);

  // Utility functions
  const formatTime = useCallback((timestamp?: number) => {
    if (!timestamp) return 'N/A';
    const adjustedTimestamp = timestamp > 1e12 ? timestamp / 1000 : timestamp;
    return new Date(adjustedTimestamp).toLocaleString();
  }, []);

  const formatCoordinates = useCallback((lat?: number, lng?: number) => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return 'N/A';
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }, []);

  const formatSpeed = useCallback((speed?: number) => {
    if (typeof speed !== 'number') return 'N/A';
    return speedUnit === 'kmh' 
      ? `${(speed * 3.6).toFixed(1)} km/h` 
      : `${(speed * 2.237).toFixed(1)} mph`;
  }, [speedUnit]);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    if (!window.google) return;
    
    try {
      const geocoder = new window.google.maps.Geocoder();
      const response = await geocoder.geocode({ location: { lat, lng } });
      if (response.results[0]) {
        setAddress(response.results[0].formatted_address);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
  }, []);

  // Map controls
  const handleZoomIn = useCallback(() => {
    if (map) {
      const newZoom = Math.min(zoomLevel + 1, 20);
      map.setZoom(newZoom);
      setZoomLevel(newZoom);
    }
  }, [map, zoomLevel]);

  const handleZoomOut = useCallback(() => {
    if (map) {
      const newZoom = Math.max(zoomLevel - 1, 1);
      map.setZoom(newZoom);
      setZoomLevel(newZoom);
    }
  }, [map, zoomLevel]);

  const toggleFullscreen = useCallback(() => {
    if (!mapRef.current) return;
    
    if (!isFullscreen) {
      mapRef.current.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const shareLocation = useCallback(() => {
    const locationToShare = showMyLocation ? myLocation : currentLocation;
    if (locationToShare?.lat && locationToShare?.lng) {
      const url = `${window.location.origin}${window.location.pathname}?lat=${locationToShare.lat}&lng=${locationToShare.lng}&zoom=${zoomLevel}`;
      
      if (navigator.share) {
        navigator.share({
          title: `${showMyLocation ? 'My Location' : selectedDevice ? `Device ${selectedDevice}` : 'Current'} Location`,
          text: `Check out this location: ${address || formatCoordinates(locationToShare.lat, locationToShare.lng)}`,
          url
        }).catch(() => {
          // Fallback if share fails
          navigator.clipboard.writeText(url);
          toast.info('Link copied to clipboard');
        });
      } else {
        navigator.clipboard.writeText(url);
        toast.info('Link copied to clipboard');
      }
    }
  }, [myLocation, currentLocation, selectedDevice, address, zoomLevel, showMyLocation]);

  const panToCurrentLocation = useCallback(() => {
    const locationToPan = showMyLocation ? myLocation : currentLocation;
    if (map && locationToPan?.lat && locationToPan?.lng) {
      map.panTo({ lat: locationToPan.lat, lng: locationToPan.lng });
      map.setZoom(15);
    }
  }, [map, myLocation, currentLocation, showMyLocation]);

  const toggleTracking = useCallback(() => {
    setIsTracking(prev => {
      if (prev) {
        toast.info('Path tracking stopped');
        setTravelPath([]);
      } else {
        toast.info('Path tracking started');
        const locationToTrack = showMyLocation ? myLocation : currentLocation;
        if (locationToTrack?.lat && locationToTrack?.lng) {
          setTravelPath([{ lat: locationToTrack.lat, lng: locationToTrack.lng }]);
        }
      }
      return !prev;
    });
  }, [myLocation, currentLocation, showMyLocation]);

  const toggleStreetView = useCallback(() => {
    if (!map) return;
    
    if (showStreetView) {
      map.setStreetView(null);
      setShowStreetView(false);
    } else {
      const locationForStreetView = showMyLocation ? myLocation : currentLocation;
      if (locationForStreetView?.lat && locationForStreetView?.lng) {
        const streetViewService = new google.maps.StreetViewService();
        streetViewService.getPanorama({
          location: { lat: locationForStreetView.lat, lng: locationForStreetView.lng },
          radius: 50
        }, (data, status) => {
          if (status === 'OK' && data) {
            const streetView = new google.maps.StreetViewPanorama(
              map.getDiv(),
              { position: { lat: locationForStreetView.lat ?? 0, lng: locationForStreetView.lng ?? 0 } }
            );
            map.setStreetView(streetView);
            setShowStreetView(true);
          } else {
            toast.warning('No Street View available at this location');
          }
        });
      }
    }
  }, [map, myLocation, currentLocation, showStreetView, showMyLocation]);

  // Data fetching and processing
  useEffect(() => {
    // Start tracking user's location
    getMyLocation();

    const devicesRef = ref(database, 'devices');
    
    const handleSnapshot = (snapshot: any) => {
      try {
        if (!snapshot.exists()) {
          setError('No devices found');
          setIsLoading(false);
          return;
        }

        const devicesData: DeviceData[] = [];
        snapshot.forEach((deviceSnapshot: any) => {
          const deviceId = deviceSnapshot.key;
          const deviceData = deviceSnapshot.val();
          
          if (deviceId) {
            devicesData.push({
              id: deviceId,
              name: deviceData?.name || `Device ${deviceId.substring(0, 4)}`,
              type: deviceData?.type || 'default',
              locations: deviceData?.locations || {},
              alerts: deviceData?.alerts || {},
              status: deviceData?.status || 'inactive'
            });
          }
        });

        setDevices(devicesData);
        setSelectedDevice(prev => prev || devicesData[0]?.id || null);
        setIsLoading(false);
      } catch (error) {
        setError(`Devices error: ${error instanceof Error ? error.message : 'Unknown'}`);
        setIsLoading(false);
      }
    };

    const unsubscribe = onValue(devicesRef, handleSnapshot, (error) => {
      setError(`Firebase error: ${error.message}`);
      setIsLoading(false);
    });

    return () => {
      off(devicesRef, 'value', unsubscribe);
    };
  }, []);

  // Fetch device data when selected device changes
  useEffect(() => {
    if (!selectedDevice) return;

    const deviceRef = ref(database, `devices/${selectedDevice}`);
    const locationsRef = query(ref(database, `devices/${selectedDevice}/locations`), limitToLast(50));
    const alertsRef = query(ref(database, `devices/${selectedDevice}/alerts`), limitToLast(10));

    const unsubscribeDevice = onValue(deviceRef, (snapshot) => {
      const deviceData = snapshot.val();
      if (deviceData) {
        setDevices(prev => prev.map(device => 
          device.id === selectedDevice ? { ...device, ...deviceData } : device
        ));
      }
    });

    const unsubscribeLocations = onValue(locationsRef, (snapshot) => {
      const locationsData = snapshot.val() || {};
      const locationsArray = Object.values(locationsData)
        .filter(isValidLocation)
        .sort((a: any, b: any) => b.timestamp - a.timestamp);
      
      setLocationHistory(locationsArray as LocationData[]);
      
      // Set current location to the most recent one
      if (locationsArray.length > 0) {
        setCurrentLocation(locationsArray[0] as LocationData);
        reverseGeocode(
          (locationsArray[0] as LocationData).lat || 0, 
          (locationsArray[0] as LocationData).lng || 0
        );
      }
    });

    const unsubscribeAlerts = onValue(alertsRef, (snapshot) => {
      const alertsData = snapshot.val() || {};
      const alertsArray = Object.values(alertsData)
        .filter(isValidAlert)
        .sort((a: any, b: any) => b.timestamp - a.timestamp);
      
      setAlerts(alertsArray as AlertData[]);
    });

    return () => {
      off(deviceRef, 'value', unsubscribeDevice);
      off(locationsRef, 'value', unsubscribeLocations);
      off(alertsRef, 'value', unsubscribeAlerts);
    };
  }, [selectedDevice]);

  // Update travel path when tracking is enabled and location changes
  useEffect(() => {
    if (!isTracking) return;

    const locationToTrack = showMyLocation ? myLocation : currentLocation;
    if (locationToTrack?.lat && locationToTrack?.lng) {
      setTravelPath(prev => {
        if (
          locationToTrack.lat !== undefined &&
          locationToTrack.lng !== undefined &&
          (prev.length === 0 || 
            google.maps.geometry.spherical.computeDistanceBetween(
              new google.maps.LatLng(prev[prev.length - 1].lat, prev[prev.length - 1].lng),
              new google.maps.LatLng(locationToTrack.lat, locationToTrack.lng)
            ) > 10)
        ) {
          return [...prev, { lat: locationToTrack.lat, lng: locationToTrack.lng }];
        }
        return prev;
      });
    }
  }, [myLocation, currentLocation, isTracking, showMyLocation]);

  // Calculate distance and speed
  const calculatePathDistance = useMemo(() => {
    if (travelPath.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 1; i < travelPath.length; i++) {
      totalDistance += google.maps.geometry.spherical.computeDistanceBetween(
        new google.maps.LatLng(travelPath[i-1].lat, travelPath[i-1].lng),
        new google.maps.LatLng(travelPath[i].lat, travelPath[i].lng)
      );
    }
    return totalDistance;
  }, [travelPath]);

  const averageSpeed = useMemo(() => {
    if (travelPath.length < 2) return 0;
    
    const firstPoint = travelPath[0];
    const lastPoint = travelPath[travelPath.length-1];
    
    // Estimate time difference (assuming points are added every few seconds)
    const timeDiff = (travelPath.length * 5) / 3600; // hours (assuming 5 seconds between points)
    if (timeDiff <= 0) return 0;
    
    return calculatePathDistance / 1000 / timeDiff; // km/h
  }, [travelPath, calculatePathDistance]);

  // Render functions
  const renderMapControls = () => (
    <div className="absolute right-2 top-2 flex flex-col gap-2 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-md z-10">
      <button onClick={handleZoomIn} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Zoom in">
        <FaPlus />
      </button>
      <button onClick={handleZoomOut} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Zoom out">
        <FaMinus />
      </button>
      <button onClick={toggleFullscreen} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
        {isFullscreen ? <FaCompress /> : <FaExpand />}
      </button>
      <button onClick={() => setMapType('roadmap')} className={`p-2 rounded ${mapType === 'roadmap' ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`} title="Road map">
        <FaLayerGroup />
      </button>
      <button onClick={() => setMapType('satellite')} className={`p-2 rounded ${mapType === 'satellite' ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`} title="Satellite">
        <FaSatellite />
      </button>
      <button onClick={toggleStreetView} className={`p-2 rounded ${showStreetView ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`} title="Street View">
        <FaStreetView />
      </button>
      <button onClick={shareLocation} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded" title="Share location">
        <FaShare />
      </button>
      <button 
        onClick={() => setShowMyLocation(!showMyLocation)} 
        className={`p-2 rounded ${showMyLocation ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        title={showMyLocation ? 'Hide my location' : 'Show my location'}
      >
        <MdMyLocation />
      </button>
    </div>
  );

  const renderDeviceInfo = () => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xl font-semibold dark:text-white">
          {devices.find(d => d.id === selectedDevice)?.name || `Device ${selectedDevice?.substring(0, 8)}...`}
        </h2>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          devices.find(d => d.id === selectedDevice)?.status === 'active' 
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
        }`}>
          {devices.find(d => d.id === selectedDevice)?.status || 'unknown'}
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">Device ID</p>
          <p className="font-mono text-blue-600 dark:text-blue-400 break-all">{selectedDevice}</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">Type</p>
          <p className="text-blue-600 dark:text-blue-400 capitalize">
            {devices.find(d => d.id === selectedDevice)?.type || 'unknown'}
          </p>
        </div>
      </div>
    </div>
  );

  const renderLocationInfo = () => {
    const displayLocation = showMyLocation ? myLocation : currentLocation;
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium dark:text-white flex items-center gap-2">
            <FaMapMarkerAlt className="text-blue-500" /> 
            {showMyLocation ? 'My Location' : 'Device Location'} Details
          </h3>
          <div className="flex gap-2">
            <button 
              onClick={panToCurrentLocation}
              className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600"
              disabled={!displayLocation?.lat || !displayLocation?.lng}
              title="Center map"
            >
              <FaSearchLocation />
            </button>
            <button
              onClick={toggleTracking}
              className={`p-2 rounded text-white ${
                isTracking 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
              title={isTracking ? 'Stop tracking path' : 'Start tracking path'}
            >
              <FaRoute />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">Coordinates</p>
            <p className="font-mono text-blue-600 dark:text-blue-400">
              {formatCoordinates(displayLocation?.lat, displayLocation?.lng)}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">Address</p>
            <p className="text-blue-600 dark:text-blue-400">
              {address || 'Loading...'}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">Accuracy</p>
            <p className="text-blue-600 dark:text-blue-400">
              {displayLocation?.accuracy ? `±${displayLocation.accuracy}m` : 'N/A'}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">Speed</p>
            <p className="text-blue-600 dark:text-blue-400">
              {formatSpeed(displayLocation?.speed)}
              <button 
                onClick={() => setSpeedUnit(prev => prev === 'kmh' ? 'mph' : 'kmh')}
                className="ml-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Switch to {speedUnit === 'kmh' ? 'mph' : 'km/h'}
              </button>
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">Last Updated</p>
            <p className="text-blue-600 dark:text-blue-400">
              {formatTime(displayLocation?.timestamp)}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">Source</p>
            <p className="text-blue-600 dark:text-blue-400 capitalize">
              {displayLocation?.source || 'Unknown'}
            </p>
          </div>
        </div>

        {isTracking && travelPath.length > 1 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">Path Distance</p>
                <p className="text-blue-600 dark:text-blue-400">
                  {(calculatePathDistance / 1000).toFixed(2)} km
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">Average Speed</p>
                <p className="text-blue-600 dark:text-blue-400">
                  {formatSpeed(averageSpeed)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Main render
  if (loadError) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">Map Loading Error</h1>
        <p className="mt-2 text-red-700 dark:text-red-300">Check your Google Maps API key</p>
      </div>
    );
  }

  if (!isLoaded || isLoading) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">Loading...</h1>
        <p className="mt-2 animate-pulse">Initializing tracking system</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Device & My Location Tracker</h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">Real-time GPS monitoring</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left sidebar */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Device
              </label>
              <select
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={selectedDevice || ''}
                onChange={(e) => setSelectedDevice(e.target.value)}
              >
                <option value="">Select device</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name || `Device ${device.id.substring(0, 8)}...`}
                  </option>
                ))}
              </select>
            </div>

            {selectedDevice && renderDeviceInfo()}
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setActiveTab('location')}
                  className={`flex-1 py-3 px-4 text-center font-medium ${
                    activeTab === 'location'
                      ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <FaMapMarkerAlt className="inline mr-2" />
                  Location
                </button>
                {selectedDevice && (
                  <>
                    <button
                      onClick={() => setActiveTab('history')}
                      className={`flex-1 py-3 px-4 text-center font-medium ${
                        activeTab === 'history'
                          ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      <FaHistory className="inline mr-2" />
                      History
                    </button>
                    <button
                      onClick={() => setActiveTab('alerts')}
                      className={`flex-1 py-3 px-4 text-center font-medium ${
                        activeTab === 'alerts'
                          ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                      }`}
                    >
                      <FaBell className="inline mr-2" />
                      Alerts
                    </button>
                  </>
                )}
              </div>
              <div className="p-4">
                {activeTab === 'location' && renderLocationInfo()}
                {activeTab === 'history' && selectedDevice && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium dark:text-white flex items-center gap-2">
                      <FaClock className="text-blue-500" /> Location History
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {locationHistory.map((location, index) => (
                        <div 
                          key={`history-${index}`}
                          className={`p-3 rounded-lg cursor-pointer ${
                            selectedHistoryPoint?.timestamp === location.timestamp
                              ? 'bg-blue-100 dark:bg-blue-900'
                              : 'bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600'
                          }`}
                          onClick={() => {
                            setSelectedHistoryPoint(location);
                            if (map && location.lat && location.lng) {
                              map.panTo({ lat: location.lat, lng: location.lng });
                            }
                          }}
                        >
                          <div className="flex justify-between items-center">
                            <p className="font-medium text-blue-600 dark:text-blue-400">
                              {formatCoordinates(location.lat, location.lng)}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {formatTime(location.timestamp)}
                            </p>
                          </div>
                          <div className="flex justify-between text-sm mt-1">
                            <p>Accuracy: {location.accuracy ? `±${location.accuracy}m` : 'N/A'}</p>
                            <p>Speed: {formatSpeed(location.speed)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {activeTab === 'alerts' && selectedDevice && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium dark:text-white flex items-center gap-2">
                      <FaBell className="text-red-500" /> Recent Alerts
                    </h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {alerts.length > 0 ? (
                        alerts.map((alert, index) => (
                          <div 
                            key={`alert-${index}`}
                            className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500"
                          >
                            <div className="flex justify-between items-center">
                              <p className="font-medium text-red-600 dark:text-red-400">
                                {alert.type || 'Alert'} - {alert.status}
                              </p>
                              <p className="text-sm text-red-500 dark:text-red-300">
                                {formatTime(alert.timestamp)}
                              </p>
                            </div>
                            {alert.message && (
                              <p className="text-sm mt-1 text-red-700 dark:text-red-300">
                                {alert.message}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                          No recent alerts
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main map area */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 relative">
              {renderMapControls()}
              
              <div 
                ref={mapRef}
                className="border rounded-lg overflow-hidden"
              >
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={
                    (showMyLocation && myLocation?.lat && myLocation?.lng) ? { 
                      lat: myLocation.lat, 
                      lng: myLocation.lng 
                    } : 
                    (currentLocation?.lat && currentLocation?.lng) ? { 
                      lat: currentLocation.lat, 
                      lng: currentLocation.lng 
                    } : defaultCenter
                  }
                  zoom={zoomLevel}
                  onLoad={(map) => setMap(map)}
                  onZoomChanged={() => map && setZoomLevel(map.getZoom() ?? zoomLevel)}
                  options={{
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: false,
                    mapTypeId: mapType,
                    styles: theme === 'dark' ? [
                      {
                        featureType: "all",
                        elementType: "all",
                        stylers: [
                          { invert_lightness: true },
                          { saturation: -40 },
                          { lightness: -30 },
                          { gamma: 0.8 }
                        ]
                      }
                    ] : []
                  }}
                >
                  {/* My location marker */}
                  {showMyLocation && myLocation?.lat && myLocation?.lng && (
                    <Marker
                      position={{ 
                        lat: myLocation.lat, 
                        lng: myLocation.lng 
                      }}
                      icon={{
                        url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                        scaledSize: new window.google.maps.Size(40, 40)
                      }}
                    />
                  )}

                  {/* Device location marker */}
                  {!showMyLocation && currentLocation?.lat && currentLocation?.lng && (
                    <Marker
                      position={{ 
                        lat: currentLocation.lat, 
                        lng: currentLocation.lng 
                      }}
                      icon={{
                        url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                        scaledSize: new window.google.maps.Size(40, 40)
                      }}
                    />
                  )}

                  {/* Location history markers */}
                  {!showMyLocation && locationHistory.map((location, index) => (
                    location?.lat && location?.lng && (
                      <Marker
                        key={`history-${location.timestamp}-${index}`}
                        position={{ lat: location.lat, lng: location.lng }}
                        icon={{
                          url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
                          scaledSize: new window.google.maps.Size(20, 20)
                        }}
                        opacity={0.7}
                      />
                    )
                  ))}

                  {/* Travel path */}
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

              {address && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-sm">
                                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <FaInfoCircle className="text-blue-500" />
                    Current Location:
                  </p>
                  <p className="text-blue-600 dark:text-blue-400 mt-1">
                    {address}
                  </p>
                </div>
              )}
            </div>

            {/* Additional status information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                <h3 className="text-lg font-medium dark:text-white flex items-center gap-2 mb-3">
                  <MdSpeed className="text-blue-500" /> Speed Information
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Current Speed</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">
                      {formatSpeed(showMyLocation ? myLocation?.speed : currentLocation?.speed)}
                    </span>
                  </div>
                  {isTracking && travelPath.length > 1 && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Average Speed</span>
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          {formatSpeed(averageSpeed)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Distance Traveled</span>
                        <span className="font-medium text-blue-600 dark:text-blue-400">
                          {(calculatePathDistance / 1000).toFixed(2)} km
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                <h3 className="text-lg font-medium dark:text-white flex items-center gap-2 mb-3">
                  <MdDirectionsCar className="text-blue-500" /> Tracking Status
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Tracking Mode</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">
                      {showMyLocation ? 'My Location' : 'Device Location'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Path Recording</span>
                    <span className={`font-medium ${
                      isTracking ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {isTracking ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Points Recorded</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">
                      {travelPath.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Theme toggle */}
        <div className="fixed bottom-4 right-4">
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </div>
    </div>
  );
}

