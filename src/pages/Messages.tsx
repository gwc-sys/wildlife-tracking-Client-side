import { useEffect, useState } from 'react';
import { database } from './firebaseDatabaseConfig'; // Correctly typed import
import { ref, onValue } from 'firebase/database'; // Import Firebase Realtime Database functions

export default function Messages() {
  const [motionStatus, setMotionStatus] = useState<string | null>(null);

  useEffect(() => {
    // Reference to the "motion_status" node in the database
    const motionStatusRef = ref(database, 'motion_status');

    // Listen for real-time updates
    const unsubscribe = onValue(motionStatusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setMotionStatus(data.status); // Assuming the data structure has a "status" field
      }
    });

    // Cleanup the listener on component unmount
    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:text-center">
          <h2 className="text-base font-semibold leading-7 text-indigo-600">Messages</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Stay Connected
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Keep up with the latest updates and communications from our team.
          </p>
        </div>

        {/* Display Motion Status */}
        <div className="mt-10 text-center">
          <h3 className="text-2xl font-bold text-gray-900">Motion Status</h3>
          <p className="mt-4 text-lg text-gray-600">
            {motionStatus ? motionStatus : 'Loading...'}
          </p>
        </div>
      </div>
    </div>
  );
}