import { useCallback, useEffect, useRef, useState } from "react";
import api from "../services/api";

export default function useApiResource(path, errorMessage, initialData = []) {
  const [data, setData] = useState(initialData);
  const [status, setStatus] = useState("loading");
  const requestIdRef = useRef(0);
  const hasDataRef = useRef(false);
  const modeRef = useRef("loading");

  const fetchResource = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      const response = await api.get(path);

      if (requestId === requestIdRef.current) {
        setData(response.data);
        hasDataRef.current = true;
        setStatus("success");
      }

      return response.data;
    } catch (error) {
      if (requestId === requestIdRef.current) {
        // A failed background refresh keeps the last good data on screen;
        // only an initial load failure surfaces the full error state.
        setStatus(modeRef.current === "reloading" ? "success" : "error");
      }

      throw error;
    }
  }, [path]);

  useEffect(() => {
    modeRef.current = "loading";
    fetchResource().catch(() => {});

    return () => {
      requestIdRef.current += 1;
    };
  }, [fetchResource]);

  const reload = useCallback(() => {
    const mode = hasDataRef.current ? "reloading" : "loading";

    modeRef.current = mode;
    setStatus(mode);

    return fetchResource();
  }, [fetchResource]);

  return {
    data,
    error: status === "error" ? errorMessage : "",
    isLoading: status === "loading",
    isReloading: status === "reloading",
    reload,
  };
}
