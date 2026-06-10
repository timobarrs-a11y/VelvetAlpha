import { useEffect, useState } from 'react';
import { supabase } from '../shared/supabase/client';
import { getMessageTrackingInfo } from '../services/messageTrackingService';
import { useSubscription } from '../hooks/useSubscription';

export default function DebugSubscriptionPage() {
  const [userId, setUserId] = useState<string>('');
  const [dbData, setDbData] = useState<any>(null);
  const [trackingInfo, setTrackingInfo] = useState<any>(null);
  const { subscriptionInfo } = useSubscription();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUserId(user.id);

    const { data } = await supabase
      .from('user_profiles')
      .select('subscription_tier, messages_remaining, haiku_model_enabled, sonnet_model_enabled, stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    setDbData(data);

    const info = await getMessageTrackingInfo(user.id);
    setTrackingInfo(info);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Subscription Debug Info</h1>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">User ID</h2>
          <code className="block bg-gray-100 p-3 rounded text-sm break-all">
            {userId || 'Loading...'}
          </code>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Database Data</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(dbData, null, 2)}
          </pre>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Message Tracking Info</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(trackingInfo, null, 2)}
          </pre>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">useSubscription Hook</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(subscriptionInfo, null, 2)}
          </pre>
        </div>

        <button
          onClick={loadData}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold"
        >
          Refresh Data
        </button>
      </div>
    </div>
  );
}
