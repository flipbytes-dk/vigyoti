'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { signIn } from 'next-auth/react';

export default function CreditValidationTestPage() {
  const { data: session, status } = useSession();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Test tweet generation validation
  const testTweetGeneration = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/test/credit-validation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quantity: 10,
          action: 'tweet_generation'
        }),
      });
      const data = await response.json();
      setResult({ type: 'Tweet Generation', data });
    } catch (error: any) {
      setResult({ 
        type: 'Tweet Generation Error', 
        error: error.message || 'An unknown error occurred' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Test thread generation validation
  const testThreadGeneration = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/test/credit-validation', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quantity: 1,
          action: 'thread_generation'
        }),
      });
      const data = await response.json();
      setResult({ type: 'Thread Generation', data });
    } catch (error: any) {
      setResult({ 
        type: 'Thread Generation Error', 
        error: error.message || 'An unknown error occurred' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Test video generation validation
  const testVideoGeneration = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/test/credit-validation', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quantity: 1,
          action: 'ai_video'
        }),
      });
      const data = await response.json();
      setResult({ type: 'Video Generation', data });
    } catch (error: any) {
      setResult({ 
        type: 'Video Generation Error', 
        error: error.message || 'An unknown error occurred' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Test image generation validation
  const testImageGeneration = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/test/credit-validation', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quantity: 1,
          action: 'ai_image'
        }),
      });
      const data = await response.json();
      setResult({ type: 'Image Generation', data });
    } catch (error: any) {
      setResult({ 
        type: 'Image Generation Error', 
        error: error.message || 'An unknown error occurred' 
      });
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return <div className="p-4">Loading...</div>;
  }

  if (status === 'unauthenticated') {
    return (
      <div className="p-4">
        <p className="mb-4">Please sign in to test credit validation</p>
        <button
          onClick={() => signIn()}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Credit Validation Test</h1>
      
      <div className="space-y-2">
        <button
          onClick={testTweetGeneration}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Test Tweet Generation
        </button>

        <button
          onClick={testThreadGeneration}
          disabled={loading}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
        >
          Test Thread Generation
        </button>

        <button
          onClick={testVideoGeneration}
          disabled={loading}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
        >
          Test Video Generation
        </button>

        <button
          onClick={testImageGeneration}
          disabled={loading}
          className="bg-pink-500 text-white px-4 py-2 rounded hover:bg-pink-600 disabled:opacity-50"
        >
          Test Image Generation
        </button>
      </div>

      {loading && (
        <div className="text-gray-600">Loading...</div>
      )}

      {result && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-2">{result.type}</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(result.data || result.error, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
} 