import { useEffect, useState } from 'react';
import { database } from './firebaseDatabaseConfig';
import { ref, onValue, off, query, limitToLast, orderByKey } from 'firebase/database';

interface MotionEvent {
  status: string;
  timestamp: number;
}

export default function MotionMonitor() {
  const [currentStatus, setCurrentStatus] = useState<MotionEvent | null>(null);
  const [history, setHistory] = useState<{id: string, data: MotionEvent}[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Format status for display
  const formatStatus = (status: string) => {
    return status === "Motion Detected" ? "🚨 Motion Detected" : "✅ No Motion";
  };

  // Format timestamp for display
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  useEffect(() => {
    const motionRef = ref(database, 'motion_status');

    // 1. Load Historical Data (last 10 events)
    const historyQuery = query(
      motionRef,
      orderByKey(),
      limitToLast(10)
    );

    const historyUnsubscribe = onValue(
      historyQuery,
      (snapshot) => {
        try {
          const historicalData: {id: string, data: MotionEvent}[] = [];
          
          snapshot.forEach((childSnapshot) => {
            const eventData = childSnapshot.val();
            if (eventData && typeof eventData === 'object') {
              historicalData.push({
                id: childSnapshot.key || `fallback-${Date.now()}`,
                data: {
                  status: eventData.status || "Status Unknown",
                  timestamp: eventData.timestamp || Date.now()
                }
              });
            }
          });

          setHistory(historicalData.reverse());
          setError(null);
        } catch (error) {
          setError(`Failed to load history: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },
      (error) => {
        setError(`History listener error: ${error.message}`);
      }
    );

    // 2. Set up real-time listener
    const realtimeUnsubscribe = onValue(
      motionRef,
      (snapshot) => {
        try {
          let latestEvent: {id: string, data: MotionEvent} | null = null;
          
          snapshot.forEach((childSnapshot) => {
            const eventData = childSnapshot.val();
            if (eventData && typeof eventData === 'object') {
              latestEvent = {
                id: childSnapshot.key || `realtime-${Date.now()}`,
                data: {
                  status: eventData.status || "Status Unknown",
                  timestamp: eventData.timestamp || Date.now()
                }
              };
            }
          });

          if (latestEvent) {
            setCurrentStatus(latestEvent.data);
            
            // Update history if this is a new event
            setHistory(prev => {
              const exists = prev.some(item => item.id === latestEvent?.id);
              return exists ? prev : [latestEvent!, ...prev.slice(0, 9)];
            });
            
            setError(null);
          }
        } catch (error) {
          setError(`Failed to process update: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      },
      (error) => {
        setError(`Real-time listener error: ${error.message}`);
      }
    );

    return () => {
      off(historyQuery);
      off(motionRef);
    };
  }, []);

  return (
    <div className="bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Motion Detection System
          </h1>
          <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 sm:mt-4">
            Real-time security monitoring
          </p>
        </div>

        {/* Current Status */}
        <div className="mt-10 bg-gray-50 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-900">Current Status</h2>
          <div className="mt-4">
            {currentStatus ? (
              <div className={`p-4 rounded-md ${
                currentStatus.status.includes("Detected") 
                  ? "bg-red-50 border border-red-200" 
                  : "bg-green-50 border border-green-200"
              }`}>
                <p className={`text-lg font-medium ${
                  currentStatus.status.includes("Detected")
                    ? "text-red-700" 
                    : "text-green-700"
                }`}>
                  {formatStatus(currentStatus.status)}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {formatTime(currentStatus.timestamp)}
                </p>
              </div>
            ) : (
              <p className="text-gray-500">Loading current status...</p>
            )}
          </div>
        </div>

        {/* Event History */}
        <div className="mt-10">
          <h2 className="text-xl font-semibold text-gray-900">Event History</h2>
          <ul className="mt-4 space-y-3">
            {history.length > 0 ? (
              history.map((event) => (
                <li 
                  key={event.id}
                  className={`p-4 rounded-md border ${
                    event.data.status.includes("Detected")
                      ? "bg-red-50 border-red-100"
                      : "bg-green-50 border-green-100"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`font-medium ${
                      event.data.status.includes("Detected")
                        ? "text-red-700"
                        : "text-green-700"
                    }`}>
                      {formatStatus(event.data.status)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatTime(event.data.timestamp)}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    Event ID: {event.id.substring(0, 8)}...
                  </div>
                </li>
              ))
            ) : (
              <li className="text-gray-500 py-4 text-center">
                {error ? "Error loading events" : "No motion events recorded yet"}
              </li>
            )}
          </ul>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-700">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}