import { useCallback, useEffect, useState } from "react";
import api from "../api/client";

/** Small data hook giving every view its loading / error / data states. */
export function useFetch(url, { params, skip } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);

  const key = JSON.stringify(params || {});
  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url, { params: JSON.parse(key) });
      setData(res.data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [url, key]);

  useEffect(() => {
    if (!skip) refetch();
  }, [refetch, skip]);

  return { data, loading, error, refetch, setData };
}
