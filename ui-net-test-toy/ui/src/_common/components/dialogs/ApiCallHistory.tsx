import { useState, useEffect } from "react";
import {
  getApiCallHistory,
  clearApiCallHistory,
  downloadApiCallHistory,
  getApiCallStats,
} from "../../utils/apiLogger";
import { DialogActions, Button } from "../ui";
import styles from "./ApiCallHistory.module.css";

interface ApiCallHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ApiCallHistory({
  isOpen,
  onClose,
}: ApiCallHistoryProps) {
  const [history, setHistory] = useState(getApiCallHistory());
  const [stats, setStats] = useState(getApiCallStats());
  const [filter, setFilter] = useState<"all" | "success" | "error">("all");
  const [selectedCall, setSelectedCall] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      refreshData();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscKey);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscKey);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const refreshData = () => {
    setHistory(getApiCallHistory());
    setStats(getApiCallStats());
  };

  const handleClearHistory = () => {
    if (
      window.confirm("Are you sure you want to clear all API call history?")
    ) {
      clearApiCallHistory();
      refreshData();
    }
  };

  const filteredHistory = history.filter((call) => {
    if (filter === "success") return call.success;
    if (filter === "error") return !call.success;
    return true;
  });

  const formatDuration = (duration?: number) => {
    if (!duration) return "—";
    return `${duration}ms`;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status?: number) => {
    if (!status) return "default";
    if (status >= 200 && status < 300) return "success";
    if (status >= 400) return "error";
    if (status >= 300) return "warning";
    return "default";
  };

  if (!isOpen) return null;

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2>🌐 API Call History</h2>
            <span className={styles.helpText}>Press ESC to close</span>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.stats}>
          <div className={styles.statItem}>
            <span>Total:</span> <strong>{stats.totalCalls || 0}</strong>
          </div>
          <div className={styles.statItem}>
            <span>Success:</span> <strong>{stats.successfulCalls || 0}</strong>
          </div>
          <div className={styles.statItem}>
            <span>Failed:</span> <strong>{stats.failedCalls || 0}</strong>
          </div>
          <div className={styles.statItem}>
            <span>Avg:</span>{" "}
            <strong>{formatDuration(stats.averageDuration)}</strong>
          </div>
        </div>

        <div className={styles.controls}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <option value="all">All Calls</option>
            <option value="success">Successful Only</option>
            <option value="error">Errors Only</option>
          </select>
          <Button onClick={refreshData}>Refresh</Button>
          <Button onClick={downloadApiCallHistory}>Download</Button>
          <button onClick={handleClearHistory} className={styles.dangerButton}>
            Clear All
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.listPanel}>
            {filteredHistory.length === 0 ? (
              <div className={styles.emptyState}>No API calls found</div>
            ) : (
              filteredHistory.map((call) => (
                <div
                  key={call.id}
                  className={`${styles.historyItem} ${
                    selectedCall?.id === call.id ? styles.selected : ""
                  }`}
                  onClick={() => setSelectedCall(call)}
                >
                  <div className={styles.itemHeader}>
                    <span
                      className={`${styles.method} ${
                        styles[call.method?.toLowerCase()]
                      }`}
                    >
                      {call.method}
                    </span>
                    <span className={styles.endpoint}>{call.endpoint}</span>
                    <span
                      className={`${styles.status} ${
                        styles[getStatusColor(call.status)]
                      }`}
                    >
                      {call.status || "N/A"}
                    </span>
                  </div>
                  <div className={styles.itemMeta}>
                    <span>{formatTimestamp(call.timestamp)}</span>
                    <span>{formatDuration(call.duration)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedCall && (
            <div className={styles.detailPanel}>
              <h3>Call Details</h3>
              <div className={styles.detailSection}>
                <strong>URL:</strong> {selectedCall.url}
              </div>
              <div className={styles.detailSection}>
                <strong>Status:</strong> {selectedCall.status}{" "}
                {selectedCall.statusText}
              </div>
              {selectedCall.body && (
                <div className={styles.detailSection}>
                  <strong>Request Body:</strong>
                  <pre>{JSON.stringify(selectedCall.body, null, 2)}</pre>
                </div>
              )}
              {selectedCall.response && (
                <div className={styles.detailSection}>
                  <strong>Response:</strong>
                  <pre>{JSON.stringify(selectedCall.response, null, 2)}</pre>
                </div>
              )}
              {selectedCall.error && (
                <div className={styles.detailSection}>
                  <strong>Error:</strong>
                  <pre>{JSON.stringify(selectedCall.error, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogActions
          onCancel={() => {}}
          onSubmit={onClose}
          cancelText=""
          submitText="Close"
        />
      </div>
    </div>
  );
}
