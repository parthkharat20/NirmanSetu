import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook for data fetching with optional auto-polling.
 * 
 * @param {string} endpoint - API endpoint (e.g., '/dashboard/overview')
 * @param {Object} options - Configuration options
 * @param {number} options.pollingInterval - Interval in milliseconds (0 for no polling)
 * @param {Array} options.dependencies - Array of dependencies that trigger a refetch
 */
export function useApi(endpoint, { pollingInterval = 0, dependencies = [] } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (isPolling = false) => {
    try {
      if (!isPolling) {
        setLoading(true);
      }
      
      const response = await fetch(`/api${endpoint}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const json = await response.json();
      setData(json);
      setError(null);
    } catch (e) {
      console.error(`Error fetching ${endpoint}:`, e);
      setError(e.message);
    } finally {
      if (!isPolling) {
        setLoading(false);
      }
    }
  }, [endpoint]);

  useEffect(() => {
    fetchData();

    let intervalId;
    if (pollingInterval > 0) {
      intervalId = setInterval(() => fetchData(true), pollingInterval);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchData, pollingInterval, ...dependencies]);

  return { data, loading, error, refetch: fetchData };
}
