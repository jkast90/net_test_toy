import React, { useState, useEffect, useRef } from 'react';
import styles from './ConnectionManager.module.css';
import { useMonitoring } from '../../_common/contexts/ConfigContext';
import { bmpService } from '../../_common/services/bmp/bmpService';

interface DaemonConnection {
  name: string;
  host: string;
  port: number;
  status: 'connected' | 'disconnected' | 'error';
  type: 'exabgp' | 'gobgp' | 'frr' | 'bmp';
}

interface LogEntry {
  timestamp: string;
  daemon: string;
  message: string;
  type: 'route' | 'info' | 'error';
}

interface BMPRoute {
  type?: string;
  prefix?: string;
  timestamp: string;
  next_hop: string | null;
  as_path: (number | string)[];
  rule?: {
    destination?: string;
    source?: string;
    protocol?: number;
    port?: number;
    dest_port?: number;
    source_port?: number;
  };
  rd?: string;
}

const ConnectionManager: React.FC = () => {
  const monitoring = useMonitoring();
  const [daemons] = useState<DaemonConnection[]>([
    { name: 'ExaBGP', host: 'localhost', port: 5000, status: 'connected', type: 'exabgp' },
    { name: 'GoBGP', host: 'localhost', port: 50071, status: 'connected', type: 'gobgp' },
    { name: 'FRR_1', host: 'localhost', port: 50051, status: 'connected', type: 'frr' },
    { name: 'FRR_2', host: 'localhost', port: 50052, status: 'connected', type: 'frr' },
    { name: 'BMP Monitor', host: 'localhost', port: 5002, status: 'connected', type: 'bmp' },
  ]);

  const [selectedDaemon, setSelectedDaemon] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [watchedPrefixes, setWatchedPrefixes] = useState<string[]>([]);
  const [newPrefix, setNewPrefix] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const previousRoutesRef = useRef<{[key: string]: Set<string>}>({});

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Helper to extract prefix from route
  const getRoutePrefix = (route: BMPRoute): string => {
    if (route.type === 'flowspec' && route.rule) {
      return route.rule.destination || route.rule.source || 'unknown';
    }
    return route.prefix || 'unknown';
  };

  // Helper to check if prefix matches watched list
  const isPrefixWatched = (prefix: string): boolean => {
    if (watchedPrefixes.length === 0) return true; // If no filters, show all

    // Check if prefix matches any watched prefix (simple contains check)
    return watchedPrefixes.some(watched => {
      // Remove CIDR notation for comparison
      const prefixBase = prefix.split('/')[0];
      const watchedBase = watched.split('/')[0];
      return prefix.includes(watchedBase) || prefixBase.includes(watchedBase);
    });
  };

  // Helper to identify daemon from peer address
  const getDaemonFromPeer = (peerAddress: string, peerAS: number): string => {
    // Map known peer addresses to daemon names based on configuration
    // This is a heuristic - adjust based on your actual topology
    if (peerAddress.includes('192.168.70.10') || peerAS === 65001) return 'GoBGP';
    if (peerAddress.includes('192.168.70.20') || peerAS === 65002) return 'FRR_1';
    if (peerAddress.includes('192.168.70.30') || peerAS === 65003) return 'FRR_2';
    if (peerAddress.includes('192.168.70.40') || peerAS === 65004) return 'ExaBGP';
    return `Peer ${peerAddress}`;
  };

  // Format route info for logging
  const formatRouteInfo = (route: BMPRoute): string => {
    if (route.type === 'flowspec' && route.rule) {
      const parts = [];
      if (route.rule.destination) parts.push(`Dst:${route.rule.destination}`);
      if (route.rule.source) parts.push(`Src:${route.rule.source}`);
      if (route.rule.protocol) parts.push(`Proto:${route.rule.protocol}`);
      if (route.rule.dest_port) parts.push(`DPort:${route.rule.dest_port}`);
      return `FlowSpec ${parts.join(' ')}`;
    }

    if (route.type === 'vpn' && route.rd) {
      return `VPN ${route.rd} ${route.prefix}`;
    }

    const nhop = route.next_hop ? ` via ${route.next_hop}` : '';
    const aspath = route.as_path && route.as_path.length > 0 ? ` AS-Path:[${route.as_path.join(' ')}]` : '';
    return `${route.prefix}${nhop}${aspath}`;
  };

  // Poll for BMP route updates
  useEffect(() => {
    const pollBMPUpdates = async () => {
      if (!monitoring?.bmp?.endpoints) {
        return;
      }

      try {
        // Use BMP service methods instead of direct fetch
        const [peers, routes, flowspecRules] = await Promise.all([
          bmpService.getBMPPeers(),
          bmpService.getBMPRoutesMap(),
          bmpService.getBMPFlowSpecRules().catch(() => [])
        ]);

        peers.forEach((peer: any) => {
          const peerKey = `${peer.address}_${peer.as}`;
          const daemonName = getDaemonFromPeer(peer.address, peer.as);
          const peerRoutes = routes[peerKey];

          if (!peerRoutes) return;

          // Track routes per peer per direction
          ['advertised', 'received'].forEach((direction) => {
            const routeList = peerRoutes[direction] || [];
            const trackingKey = `${peerKey}_${direction}`;

            // Initialize tracking set if needed
            if (!previousRoutesRef.current[trackingKey]) {
              previousRoutesRef.current[trackingKey] = new Set();
              // Don't log initial routes to avoid spam
              routeList.forEach((route: BMPRoute) => {
                const prefix = getRoutePrefix(route);
                previousRoutesRef.current[trackingKey].add(prefix);
              });
              return;
            }

            // Check for new routes
            const previousRoutes = previousRoutesRef.current[trackingKey];
            const newRoutes: BMPRoute[] = [];

            routeList.forEach((route: BMPRoute) => {
              const prefix = getRoutePrefix(route);
              if (!previousRoutes.has(prefix)) {
                newRoutes.push(route);
                previousRoutes.add(prefix);
              }
            });

            // Log new routes that match watched prefixes
            newRoutes.forEach((route) => {
              const prefix = getRoutePrefix(route);
              if (isPrefixWatched(prefix)) {
                const routeInfo = formatRouteInfo(route);
                const directionLabel = direction === 'advertised' ? 'advertised' : 'received';
                addLog('route', daemonName, `${directionLabel.toUpperCase()}: ${routeInfo}`);
              }
            });
          });
        });

        // Track FlowSpec rules
        const trackingKey = 'flowspec_rules';

        if (!previousRoutesRef.current[trackingKey]) {
          previousRoutesRef.current[trackingKey] = new Set();
          // Initialize with existing rules
          flowspecRules.forEach((rule: any) => {
            const ruleKey = JSON.stringify(rule.match);
            previousRoutesRef.current[trackingKey].add(ruleKey);
          });
        } else {
          // Check for new flowspec rules
          const previousRules = previousRoutesRef.current[trackingKey];
          flowspecRules.forEach((rule: any) => {
            const ruleKey = JSON.stringify(rule.match);
            if (!previousRules.has(ruleKey)) {
              previousRules.add(ruleKey);

              // Build rule description
              const parts = [];
              if (rule.match.destination) parts.push(`Dst:${rule.match.destination}`);
              if (rule.match.source) parts.push(`Src:${rule.match.source}`);
              if (rule.match.protocol) parts.push(`Proto:${rule.match.protocol}`);
              if (rule.match.dest_port) parts.push(`DPort:${rule.match.dest_port}`);
              const ruleDesc = parts.join(' ');

              const action = rule.actions.action || 'unknown';
              const rate = rule.actions.rate ? ` ${rule.actions.rate}Mbps` : '';

              // Check if rule matches watched prefixes
              const prefix = rule.match.destination || rule.match.source || '';
              if (isPrefixWatched(prefix)) {
                addLog('route', 'GoBGP', `NEW FLOWSPEC: ${ruleDesc} Action:${action}${rate}`);
              }
            }
          });
        }

      } catch (err) {
        console.error('Error polling BMP:', err);
      }
    };

    if (monitoring?.bmp?.endpoints) {
      // Initial poll
      pollBMPUpdates();

      // Set up interval - increased from 2s to 10s to reduce server load
      const interval = setInterval(pollBMPUpdates, 10000);
      return () => clearInterval(interval);
    }
  }, [monitoring, watchedPrefixes]);

  const addWatchedPrefix = () => {
    if (newPrefix && !watchedPrefixes.includes(newPrefix)) {
      setWatchedPrefixes([...watchedPrefixes, newPrefix]);
      setNewPrefix('');
      addLog('info', 'System', `Now watching prefix: ${newPrefix}`);
    }
  };

  const removeWatchedPrefix = (prefix: string) => {
    setWatchedPrefixes(watchedPrefixes.filter(p => p !== prefix));
    addLog('info', 'System', `Stopped watching prefix: ${prefix}`);
  };

  const addLog = (type: 'route' | 'info' | 'error', daemon: string, message: string) => {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      daemon,
      message,
      type
    };
    setLogs(prev => [...prev, entry]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return '#4ade80';
      case 'disconnected': return '#64748b';
      case 'error': return '#f87171';
      default: return '#64748b';
    }
  };

  return (
    <div className={styles.connectionManager}>
      <div className={styles.header}>
        <h3>Connection Manager</h3>
        <button
          className={styles.clearButton}
          onClick={clearLogs}
          title="Clear logs"
        >
          Clear Logs
        </button>
      </div>

      {/* Daemon Status */}
      <div className={styles.daemonGrid}>
        {daemons.map(daemon => (
          <div
            key={daemon.name}
            className={`${styles.daemonCard} ${selectedDaemon === daemon.name ? styles.selected : ''}`}
            onClick={() => setSelectedDaemon(daemon.name)}
          >
            <div className={styles.daemonHeader}>
              <span
                className={styles.statusDot}
                style={{ backgroundColor: getStatusColor(daemon.status) }}
              />
              <span className={styles.daemonName}>{daemon.name}</span>
            </div>
            <div className={styles.daemonInfo}>
              <span className={styles.label}>Host:</span> {daemon.host}:{daemon.port}
            </div>
            <div className={styles.daemonInfo}>
              <span className={styles.label}>Type:</span> {daemon.type.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {/* Watched Prefixes */}
      <div className={styles.watchSection}>
        <h4>Watched Prefixes</h4>
        <div className={styles.watchInput}>
          <input
            type="text"
            value={newPrefix}
            onChange={(e) => setNewPrefix(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addWatchedPrefix()}
            placeholder="e.g., 10.0.0.0/8"
            className={styles.prefixInput}
          />
          <button onClick={addWatchedPrefix} className={styles.addButton}>
            Watch
          </button>
        </div>
        <div className={styles.prefixList}>
          {watchedPrefixes.map(prefix => (
            <div key={prefix} className={styles.prefixTag}>
              <span>{prefix}</span>
              <button
                onClick={() => removeWatchedPrefix(prefix)}
                className={styles.removeButton}
              >
                ×
              </button>
            </div>
          ))}
          {watchedPrefixes.length === 0 && (
            <p className={styles.emptyState}>No prefixes being watched</p>
          )}
        </div>
      </div>

      {/* Log Viewer */}
      <div className={styles.logSection}>
        <div className={styles.logHeader}>
          <h4>Activity Log</h4>
          <label className={styles.autoScrollLabel}>
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>
        </div>
        <div
          ref={logContainerRef}
          className={styles.logContainer}
        >
          {logs.length === 0 ? (
            <p className={styles.emptyState}>No activity yet</p>
          ) : (
            logs.map((log, idx) => (
              <div
                key={idx}
                className={`${styles.logEntry} ${styles[log.type]}`}
              >
                <span className={styles.timestamp}>{log.timestamp}</span>
                <span className={styles.daemon}>[{log.daemon}]</span>
                <span className={styles.message}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectionManager;
