import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface Recommendation {
  product: string;
  forecasted_sales: number;
  recommended_stock: number;
  safety_buffer: number;
  mape: number;
}

export interface ForecastData {
  store_id: string;
  forecast_week: string;
  forecasts: Record<string, number>;
  recommendations: Recommendation[];
  model_metrics: Record<string, any>;
  historical_dates: string[];
  historical_sales: Record<string, number[]>;
  missing_days_by_week: Record<string, number>;
  missing_dates?: string[];
}

export const useForecast = () => {
  const [data, setData] = useState<ForecastData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchForecast = useCallback(async (storeId: string, forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const cacheKey = `forecast_v3_${storeId}`;
      if (!forceRefresh) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            const now = new Date().getTime();
            // Cache for 24 hours
            if (now - parsed.timestamp < 24 * 60 * 60 * 1000) {
              setData(parsed.data);
              setIsLoading(false);
              return;
            }
          } catch (e) {
            console.warn("Mangled cache data");
          }
        }
      }

      // Get auth token automatically from local session
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
         throw new Error("You must be logged in to view forecasts");
      }

      // In production, proxy through Vercel serverless function (HTTPS) to avoid mixed content.
      // In dev over HTTP, hit the Python backends directly with automatic fallback.
      // If the page is served over HTTPS (including HTTPS dev previews), always use the proxy
      // to avoid browser mixed-content blocks.
      const isDev = import.meta.env.DEV;
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

      let response: Response;

      if (isDev && !isHttps) {
        const devBackends = [
          `http://botspark.de1.octavia.id:25647/api/forecast/${storeId}`,
          `http://game-1.sapphire-cloud.org:25612/api/forecast/${storeId}`,
        ];

        let lastErr: string = '';
        let devResponse: Response | null = null;

        for (const url of devBackends) {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);
            const resp = await fetch(url, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              signal: controller.signal,
            });
            clearTimeout(timeout);

            if (resp.ok) {
              devResponse = resp;
              break;
            }
            lastErr = `${url} returned ${resp.status}`;
          } catch (e: any) {
            lastErr = e.message || 'Connection failed';
            console.warn(`[Forecast Dev] ${url} failed: ${lastErr}`);
          }
        }

        if (!devResponse) throw new Error(lastErr || 'All backends unavailable');
        response = devResponse;
      } else {
        response = await fetch(`/api/forecast?store_id=${storeId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
      }

      if (!response.ok) {
         const errData = await response.json().catch(() => null);
         throw new Error(errData?.error || "Failed to fetch ML generated forecast");
      }

      const mlData = await response.json();
      
      // Save to cache
      localStorage.setItem(cacheKey, JSON.stringify({ data: mlData, timestamp: new Date().getTime() }));
      setData(mlData);

    } catch (err: any) {
      setError(err.message);
      console.error("Forecast Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { data, isLoading, error, fetchForecast };
}
