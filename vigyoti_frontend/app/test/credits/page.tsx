'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function CreditTestPage() {
  const { data: session } = useSession();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Test credit usage
  const testCreditUsage = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/credits/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'tweet_generation',
          amount: 10,
          details: {
            count: 10,
            success: true,
          },
        }),
      });
      const data = await response.json();
      setResult({ type: 'Credit Usage', data });
    } catch (error: any) {
      setResult({ 
        type: 'Credit Usage Error', 
        error: error.message || 'An unknown error occurred' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  // Format amount with sign
  const formatAmount = (amount: number) => {
    return amount > 0 ? `+${amount}` : amount.toString();
  };

  // Test credit history
  const testCreditHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/credits/transactions');
      const data = await response.json();
      
      if (!response.ok) {
        // Check if we're in the indexing state
        if (response.status === 503 && data.isIndexing) {
          setResult({ 
            type: 'Credit History', 
            message: data.message || 'System is being initialized. Please try again in a few minutes.',
            status: 'indexing'
          });
          return;
        }
        throw new Error(data.error || 'Failed to fetch credit history');
      }
      
      // Format the history for display
      const formattedHistory = data.map((transaction: any) => ({
        ...transaction,
        formattedTimestamp: formatTimestamp(transaction.timestamp),
        formattedAmount: formatAmount(transaction.amount),
        formattedRefundedAt: transaction.refundedAt ? formatTimestamp(transaction.refundedAt) : null,
      }));
      
      setResult({ 
        type: 'Credit History', 
        data: formattedHistory,
        message: data.length === 0 ? 'No credit history found' : undefined
      });
    } catch (error: any) {
      console.error('Credit history error:', error);
      setResult({ 
        type: 'Credit History Error', 
        error: error.message || 'An unknown error occurred',
        details: error
      });
    } finally {
      setLoading(false);
    }
  };

  // Test credit refund
  const testCreditRefund = async () => {
    try {
      setLoading(true);
      // First get history to get a transaction ID
      const historyResponse = await fetch('/api/credits/transactions');
      if (!historyResponse.ok) {
        const errorData = await historyResponse.json();
        throw new Error(errorData.error || 'Failed to fetch credit history');
      }
      
      const history = await historyResponse.json();
      if (!Array.isArray(history) || history.length === 0) {
        throw new Error('No transactions found to refund');
      }

      const transactionId = history[0].id;
      const response = await fetch('/api/credits/transactions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          amount: 5,
          reason: 'Test refund',
        }),
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process refund');
      }
      
      setResult({ type: 'Credit Refund', data });
    } catch (error: any) {
      console.error('Credit refund error:', error);
      setResult({ 
        type: 'Credit Refund Error', 
        error: error.message || 'An unknown error occurred',
        details: error
      });
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return <div className="p-4">Please sign in to test credit operations</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Credit System Test Page</h1>
      
      <div className="space-x-4">
        <button
          onClick={testCreditUsage}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Test Credit Usage
        </button>

        <button
          onClick={testCreditHistory}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          View Credit History
        </button>

        <button
          onClick={testCreditRefund}
          disabled={loading}
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
        >
          Test Credit Refund
        </button>
      </div>

      {loading && (
        <div className="mt-4">Loading...</div>
      )}

      {result && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold">{result.type} Result:</h2>
          <pre className="mt-2 p-4 bg-gray-100 rounded overflow-auto">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
} 