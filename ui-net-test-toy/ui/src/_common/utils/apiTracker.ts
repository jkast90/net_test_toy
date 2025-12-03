// Global API call tracker
class ApiTracker {
  private activeRequests = new Set<string>();
  private listeners: Array<(count: number) => void> = [];

  // Generate unique request ID
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Start tracking a request
  startRequest(): string {
    const requestId = this.generateId();
    this.activeRequests.add(requestId);
    this.notifyListeners();
    // console.debug(
    //   `[ApiTracker] Request started: ${requestId}, active: ${this.activeRequests.size}`,
    // );
    return requestId;
  }

  // End tracking a request
  endRequest(requestId: string): void {
    if (this.activeRequests.has(requestId)) {
      this.activeRequests.delete(requestId);
      this.notifyListeners();
      // console.debug(
      //   `[ApiTracker] Request ended: ${requestId}, active: ${this.activeRequests.size}`,
      // );
    }
  }

  // Get current active request count
  getActiveCount(): number {
    return this.activeRequests.size;
  }

  // Check if any requests are active
  hasActiveRequests(): boolean {
    return this.activeRequests.size > 0;
  }

  // Subscribe to changes
  subscribe(listener: (count: number) => void): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Notify all listeners
  private notifyListeners(): void {
    const count = this.activeRequests.size;
    this.listeners.forEach((listener) => listener(count));
  }

  // Clear all requests (for cleanup)
  clear(): void {
    this.activeRequests.clear();
    this.notifyListeners();
  }
}

// Create singleton instance
export const apiTracker = new ApiTracker();

// Intercept all fetch calls
const originalFetch = window.fetch;
window.fetch = async function (...args) {
  const requestId = apiTracker.startRequest();

  try {
    const response = await originalFetch.apply(this, args);
    // Clone the response to avoid consuming it
    const clonedResponse = response.clone();

    // End request after response is received
    apiTracker.endRequest(requestId);

    return response;
  } catch (error) {
    apiTracker.endRequest(requestId);
    throw error;
  }
};

// Export for use in components
export default apiTracker;
