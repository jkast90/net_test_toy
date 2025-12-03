// src/hooks/useApiFetch.ts
import { useState, useCallback } from "react";
import { fetchWrapper } from "../utils/fetchWrapper";

export default function useApiFetch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchJson = useCallback(async (url, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchWrapper(url, options);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { fetchJson, loading, error };
}
