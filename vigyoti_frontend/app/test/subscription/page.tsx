'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { PlanType } from '@/types/subscription';

export default function SubscriptionTestPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  const changePlan = async (plan: PlanType) => {
    setLoading(true);
    setError('');
    setResult('');
    
    try {
      const response = await fetch('/api/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setResult(`Successfully changed plan to ${plan}`);
    } catch (err: any) {
      setError(err?.message || 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const cancelSubscription = async () => {
    setLoading(true);
    setError('');
    setResult('');
    
    try {
      const response = await fetch('/api/subscription', {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      setResult('Successfully cancelled subscription');
    } catch (err: any) {
      setError(err?.message || 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const reactivateSubscription = async () => {
    setLoading(true);
    setError('');
    setResult('');
    
    try {
      const response = await fetch('/api/subscription', {
        method: 'PATCH',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      setResult('Successfully reactivated subscription');
    } catch (err: any) {
      setError(err?.message || 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  if (status === 'unauthenticated') {
    return <div>Please sign in to test subscription management</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Subscription Management Test</h1>
      
      <div className="space-y-4">
        <div className="space-x-2">
          <button
            onClick={() => changePlan('solo')}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Change to Solo Plan
          </button>
          
          <button
            onClick={() => changePlan('team')}
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            Change to Team Plan
          </button>
          
          <button
            onClick={() => changePlan('agency')}
            disabled={loading}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
          >
            Change to Agency Plan
          </button>
        </div>
        
        <div className="space-x-2">
          <button
            onClick={cancelSubscription}
            disabled={loading}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            Cancel Subscription
          </button>
          
          <button
            onClick={reactivateSubscription}
            disabled={loading}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
          >
            Reactivate Subscription
          </button>
        </div>
        
        {loading && (
          <div className="text-gray-600">Loading...</div>
        )}
        
        {error && (
          <div className="text-red-500">Error: {error}</div>
        )}
        
        {result && (
          <div className="text-green-500">{result}</div>
        )}
      </div>
    </div>
  );
} 