import { useState, useEffect } from "react";
import {
  getTelemetryHistory,
  clearTelemetryHistory,
  downloadTelemetryData,
  getTelemetryStats,
} from "../../utils/telemetry";
import { DialogActions, Button } from "../ui";
import styles from "./TelemetryViewer.module.css";

interface TelemetryViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TelemetryViewer({
  isOpen,
  onClose,
}: TelemetryViewerProps) {
  const [history, setHistory] = useState(getTelemetryHistory());
  const [stats, setStats] = useState(getTelemetryStats());
  const [filter, setFilter] = useState<string>("all");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

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
    setHistory(getTelemetryHistory());
    setStats(getTelemetryStats());
  };

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear all telemetry data?")) {
      clearTelemetryHistory();
      refreshData();
    }
  };

  const filteredHistory = history.filter((event) => {
    if (filter === "all") return true;
    return event.eventType === filter;
  });

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getEventIcon = (eventType: string) => {
    if (eventType.includes("error")) return "❌";
    if (eventType.includes("page")) return "📄";
    if (eventType.includes("click") || eventType.includes("button"))
      return "🖱️";
    if (eventType.includes("api")) return "🌐";
    if (eventType.includes("performance")) return "⚡";
    return "📊";
  };

  if (!isOpen) return null;

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const eventTypes = Object.keys(stats.eventTypes || {});

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2>📊 Telemetry Dashboard</h2>
            <span className={styles.helpText}>Press ESC to close</span>
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.stats}>
          <div className={styles.statItem}>
            <span>Total Events:</span> <strong>{stats.totalEvents || 0}</strong>
          </div>
          <div className={styles.statItem}>
            <span>Sessions:</span> <strong>{stats.sessionCount || 0}</strong>
          </div>
          <div className={styles.statItem}>
            <span>Errors:</span> <strong>{stats.errorCount || 0}</strong>
          </div>
          <div className={styles.statItem}>
            <span>Avg Session:</span>{" "}
            <strong>
              {Math.round((stats.averageSessionDuration || 0) / 1000)}s
            </strong>
          </div>
        </div>

        <div className={styles.controls}>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Events</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type} ({stats.eventTypes[type]})
              </option>
            ))}
          </select>
          <Button onClick={refreshData}>Refresh</Button>
          <Button onClick={downloadTelemetryData}>Download</Button>
          <button onClick={handleClearHistory} className={styles.dangerButton}>
            Clear All
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.listPanel}>
            {filteredHistory.length === 0 ? (
              <div className={styles.emptyState}>No telemetry events found</div>
            ) : (
              filteredHistory.map((event) => (
                <div
                  key={event.id}
                  className={`${styles.eventItem} ${
                    selectedEvent?.id === event.id ? styles.selected : ""
                  }`}
                  onClick={() => setSelectedEvent(event)}
                >
                  <div className={styles.itemHeader}>
                    <span className={styles.icon}>
                      {getEventIcon(event.eventType)}
                    </span>
                    <span className={styles.eventType}>{event.eventType}</span>
                    {event.action && (
                      <span className={styles.action}>→ {event.action}</span>
                    )}
                  </div>
                  <div className={styles.itemMeta}>
                    <span>{formatTimestamp(event.timestamp)}</span>
                    {event.label && (
                      <span className={styles.label}>{event.label}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {selectedEvent && (
            <div className={styles.detailPanel}>
              <h3>Event Details</h3>
              <div className={styles.detailSection}>
                <strong>Event Type:</strong> {selectedEvent.eventType}
              </div>
              {selectedEvent.action && (
                <div className={styles.detailSection}>
                  <strong>Action:</strong> {selectedEvent.action}
                </div>
              )}
              {selectedEvent.category && (
                <div className={styles.detailSection}>
                  <strong>Category:</strong> {selectedEvent.category}
                </div>
              )}
              {selectedEvent.label && (
                <div className={styles.detailSection}>
                  <strong>Label:</strong> {selectedEvent.label}
                </div>
              )}
              <div className={styles.detailSection}>
                <strong>URL:</strong> {selectedEvent.url}
              </div>
              <div className={styles.detailSection}>
                <strong>Session ID:</strong> {selectedEvent.sessionId}
              </div>
              {selectedEvent.metadata &&
                Object.keys(selectedEvent.metadata).length > 0 && (
                  <div className={styles.detailSection}>
                    <strong>Metadata:</strong>
                    <pre>{JSON.stringify(selectedEvent.metadata, null, 2)}</pre>
                  </div>
                )}
              <div className={styles.detailSection}>
                <strong>Full Event:</strong>
                <pre>{JSON.stringify(selectedEvent, null, 2)}</pre>
              </div>
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
