import { useState, useEffect } from "react";
import { apiTracker } from "../utils/apiTracker";

export function useApiTracker() {
  const [activeRequests, setActiveRequests] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Subscribe to API tracker updates
    const unsubscribe = apiTracker.subscribe((count) => {
      setActiveRequests(count);
      setIsLoading(count > 0);
    });

    // Set initial state
    setActiveRequests(apiTracker.getActiveCount());
    setIsLoading(apiTracker.hasActiveRequests());

    // Cleanup on unmount
    return unsubscribe;
  }, []);

  return {
    activeRequests,
    isLoading,
    hasActiveRequests: isLoading,
  };
}
