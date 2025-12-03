/**
 * Test Output Pane Component
 * Displays real-time test output with auto-scroll
 */

import React, { useRef, useEffect, useState } from 'react';
import Card from '../../../_common/components/Card';
import { Button, ButtonGroup } from '../../../_common/components/ui';
import styles from '../../pages/NetworkTesting.module.css';
import buttonCss from '../../../_common/styles/Button.module.css';
import { getAllIPs } from '../../../_common/utils/networkUtils';

type OutputMode = 'clean' | 'raw' | 'parsed';

interface NetworkInterface {
  network: string;
  ipv4: string;
  gateway?: string;
}

interface NodeData {
  name: string;
  type: string;
  interfaces: NetworkInterface[];
}

type TestType = 'ping' | 'traceroute' | 'iperf' | 'hping' | 'curl';

interface TestOutputPaneProps {
  output: string[];
  viewingTestId?: string;
  onDisconnect?: () => void;
  isRunning?: boolean;
  currentTestId?: string;
  error?: string;
  mini?: boolean;
  onClose?: () => void;
  onStop?: () => void;
  sourceNode?: NodeData;
  targetNode?: NodeData;
  labHosts?: any[];
  onStartTest?: (srcIp: string, dstIp: string, testType: TestType) => void;
}

export const TestOutputPane: React.FC<TestOutputPaneProps> = ({
  output,
  viewingTestId,
  onDisconnect,
  isRunning = false,
  currentTestId,
  error,
  mini = false,
  onClose,
  onStop,
  labHosts = [],
  onStartTest
}) => {
  const outputRef = useRef<HTMLDivElement | null>(null);
  const [outputMode, setOutputMode] = useState<OutputMode>(mini ? 'parsed' : 'clean');
  const [isMinimized, setIsMinimized] = useState(false);
  const [srcIp, setSrcIp] = useState('');
  const [dstIp, setDstIp] = useState('');
  const [testType, setTestType] = useState<TestType>('ping');

  // Auto-select first interface when labHosts are available
  useEffect(() => {
    if (labHosts && labHosts.length > 0) {
      const firstHost = labHosts[0];
      const firstIPs = getAllIPs(firstHost);
      if (firstIPs.length > 0 && !srcIp) {
        setSrcIp(firstIPs[0].ip);
      }

      const secondHost = labHosts.length > 1 ? labHosts[1] : labHosts[0];
      const secondIPs = getAllIPs(secondHost);
      if (secondIPs.length > 0 && !dstIp) {
        setDstIp(secondIPs[0].ip);
      }
    }
  }, [labHosts]);

  // Dragging and resizing state for mini mode
  const [position, setPosition] = useState({ x: 20, y: 20 }); // Start bottom-right (will be calculated from bottom/right)
  const [size, setSize] = useState({ width: 500, height: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const dragRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Auto-disconnect when process exits
  useEffect(() => {
    if (viewingTestId && onDisconnect && output.length > 0) {
      const lastLine = output[output.length - 1];
      const cleanLine = stripTimestamp(lastLine);
      if (cleanLine.includes('process exited')) {
        onDisconnect();
      }
    }
  }, [output, viewingTestId, onDisconnect]);

  // Handle mouse dragging and resizing for mini mode
  useEffect(() => {
    if (!mini) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && dragRef.current) {
        // Use parent element for consistent positioning (like CanvasOverlayPane)
        const parent = dragRef.current.parentElement;
        if (parent) {
          const parentRect = parent.getBoundingClientRect();
          const relativeX = e.clientX - parentRect.left - dragOffset.x;
          const relativeY = e.clientY - parentRect.top - dragOffset.y;
          const maxX = parentRect.width - size.width;
          const maxY = parentRect.height - size.height;
          const newX = Math.max(0, Math.min(maxX, relativeX));
          const newY = Math.max(0, Math.min(maxY, relativeY));
          setPosition({ x: newX, y: newY });
        }
      } else if (isResizing && dragRef.current) {
        // Calculate new size based on mouse position
        const parent = dragRef.current.parentElement;
        const parentRect = parent?.getBoundingClientRect();
        const maxWidth = parentRect ? parentRect.width - position.x : 800;
        const maxHeight = parentRect ? parentRect.height - position.y : 600;

        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        const newWidth = Math.max(300, Math.min(maxWidth, resizeStart.width + deltaX));
        const newHeight = Math.max(200, Math.min(maxHeight, resizeStart.height + deltaY));

        setSize({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, mini, size, position, resizeStart]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current && mini) {
      const rect = dragRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  // Strip timestamp from line (format: [2025-11-23T00:32:58.094472+00:00] )
  const stripTimestamp = (line: string): string => {
    return line.replace(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+[+-]\d{2}:\d{2}\]\s*/, '');
  };

  // Parse line into simplified format
  const parseLine = (line: string): string => {
    const clean = stripTimestamp(line);

    // Skip metadata lines
    if (clean.startsWith('###') || clean.startsWith('##') || clean.startsWith('#')) {
      return '';
    }

    // Parse process exit line
    if (clean.includes('process exited with code -9')) {
      return 'Test Stopped';
    }
    if (clean.includes('process exited with code 1')) {
      return 'Exited with error';
    }
    if (clean.includes('process exited with code 0')) {
      return 'Test complete';
    }
    // Handle other exit codes
    const exitCodeMatch = clean.match(/process exited with code (-?\d+)/);
    if (exitCodeMatch) {
      return `Exited with unknown code (${exitCodeMatch[1]})`;
    }
    if (clean.includes('process exited')) {
      return '';
    }

    // Parse frontend error messages
    if (clean.startsWith('Error: Server WebSocket error:')) {
      return 'Server connection failed';
    }
    if (clean.startsWith('Error:')) {
      return clean; // Keep other Error: messages as-is
    }

    // Parse iperf error messages
    const iperfErrorMatch = clean.match(/iperf3?: error - .+:\s+(.+)$/);
    if (iperfErrorMatch) {
      return `Connection failed: ${iperfErrorMatch[1]}`;
    }

    // Parse server output lines (keep them but mark as server)
    if (clean.startsWith('[Server]')) {
      // Extract just the message after [Server]
      return clean.replace(/^\[Server\]\s*/, 'Server: ');
    }

    // Parse status messages
    if (clean === 'Starting iperf server on target host...') {
      return 'Starting server...';
    }
    if (clean === 'Waiting for iperf server to be ready...') {
      return 'Waiting for server...';
    }
    if (clean === 'Warning: Server did not confirm ready status') {
      return 'Warning: Server startup not confirmed';
    }
    if (clean === 'Starting iperf client...') {
      return 'Starting client...';
    }

    // Parse PING start line
    const pingStartMatch = clean.match(/^PING\s+([\d.]+)\s+.*from\s+([\d.]+)/);
    if (pingStartMatch) {
      return `Start ping to ${pingStartMatch[1]} from ${pingStartMatch[2]}`;
    }

    // Parse response line
    const responseMatch = clean.match(/^\d+\s+bytes from\s+([\d.]+).*time=([\d.]+)\s*ms/);
    if (responseMatch) {
      return `Response time ${responseMatch[2]} ms`;
    }

    // Parse statistics line
    const statsMatch = clean.match(/^(\d+)\s+packets transmitted,\s+(\d+)\s+received,\s+([\d.]+)%\s+packet loss,\s+time\s+([\d.]+)ms/);
    if (statsMatch) {
      return `${statsMatch[1]}/${statsMatch[2]} ${statsMatch[3]}% loss ${statsMatch[4]}ms`;
    }

    // Parse RTT line
    const rttMatch = clean.match(/^rtt\s+min\/avg\/max\/mdev\s+=\s+([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)\s*ms/);
    if (rttMatch) {
      return `RTT avg ${rttMatch[2]} ms (min ${rttMatch[1]} / max ${rttMatch[3]})`;
    }

    // Parse ping separator
    if (clean.match(/^---.*ping statistics ---$/)) {
      return '---';
    }

    // Parse iperf header line
    if (clean.match(/^\[\s*ID\]\s+Interval\s+Transfer\s+Bitrate/)) {
      return ''; // Skip header
    }

    // Parse iperf connection line
    const iperfConnMatch = clean.match(/^\[\s*\d+\]\s+local\s+([\d.]+)\s+port\s+\d+\s+connected to\s+([\d.]+)\s+port\s+(\d+)/);
    if (iperfConnMatch) {
      return `Connected ${iperfConnMatch[1]} → ${iperfConnMatch[2]}:${iperfConnMatch[3]}`;
    }

    // Parse iperf "Connecting to host" line
    const connectingMatch = clean.match(/^Connecting to host\s+([\d.]+),\s+port\s+(\d+)/);
    if (connectingMatch) {
      return `Connecting to ${connectingMatch[1]}:${connectingMatch[2]}...`;
    }

    // Parse iperf progress line with timestamp extraction
    // Format: [  5]   0.00-1.00   sec  1.50 MBytes  12.5 Mbits/sec  266   7.07 KBytes
    const iperfProgressMatch = clean.match(/^\[\s*\d+\]\s+([\d.]+)-([\d.]+)\s+sec\s+[\d.]+\s*[KMG]?Bytes\s+([\d.]+)\s*([KMG]?bits\/sec)(?:\s+(\d+))?/);
    if (iperfProgressMatch) {
      const startTime = parseFloat(iperfProgressMatch[1]);
      const endTime = parseFloat(iperfProgressMatch[2]);
      const bitrate = iperfProgressMatch[3];
      const bitrateUnit = iperfProgressMatch[4];
      const retries = iperfProgressMatch[5];

      // Format a concise output with timestamp
      let result = `[${startTime.toFixed(0)}-${endTime.toFixed(0)}s] ${bitrate} ${bitrateUnit}`;
      if (retries) {
        result += ` (${retries} retr)`;
      }
      return result;
    }

    // Parse iperf summary line (sender/receiver)
    const iperfSummaryMatch = clean.match(/^\[\s*\d+\]\s+[\d.]+-[\d.]+\s+sec\s+[\d.]+\s*[KMG]?Bytes\s+([\d.]+)\s*([KMG]?bits\/sec)(?:\s+(\d+))?\s+(sender|receiver)/);
    if (iperfSummaryMatch) {
      const bitrate = iperfSummaryMatch[1];
      const bitrateUnit = iperfSummaryMatch[2];
      const retries = iperfSummaryMatch[3];
      const role = iperfSummaryMatch[4];

      let result = `${role === 'sender' ? '📤' : '📥'} ${role}: ${bitrate} ${bitrateUnit}`;
      if (retries) {
        result += ` (${retries} retr)`;
      }
      return result;
    }

    // Parse "iperf Done" line
    if (clean === 'iperf Done.') {
      return 'Test complete';
    }

    // Parse iperf separator
    if (clean.match(/^-\s+-\s+-\s+-\s+-/)) {
      return '---';
    }

    // Skip empty lines
    if (!clean.trim()) {
      return '';
    }

    // Return original for unmatched patterns
    return clean;
  };

  // Format line based on mode
  const formatLine = (line: string): string => {
    switch (outputMode) {
      case 'raw':
        return line;
      case 'parsed':
        return parseLine(line);
      case 'clean':
      default:
        return stripTimestamp(line);
    }
  };

  // Mini mode rendering (draggable overlay)
  if (mini) {
    const displayLines = output
      .map(line => formatLine(line))
      .filter(line => line !== '');

    // When minimized, snap to bottom center of canvas container
    // When expanded, use draggable position (absolute within container)
    const minimizedStyle: React.CSSProperties = {
      position: 'absolute',
      bottom: '10px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '300px',
      height: 'auto',
      background: '#1a1a1a',
      border: '1px solid #444',
      borderRadius: '6px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      cursor: 'default'
    };

    const expandedStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${size.width}px`,
      height: `${size.height}px`,
      background: '#1a1a1a',
      border: '1px solid #444',
      borderRadius: '6px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 100,
      cursor: isDragging ? 'grabbing' : 'default'
    };

    return (
      <div
        ref={dragRef}
        style={isMinimized ? minimizedStyle : expandedStyle}>
        {/* Header */}
        <div
          onMouseDown={isMinimized ? undefined : handleMouseDown}
          style={{
            padding: '0.75rem',
            borderBottom: isMinimized ? 'none' : '1px solid #444',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#2a2a2a',
            borderRadius: isMinimized ? '6px' : undefined,
            cursor: isMinimized ? 'default' : (isDragging ? 'grabbing' : 'grab')
          }}>
          <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>Test Output</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {isRunning && onStop && !isMinimized && (
              <button
                onClick={onStop}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  background: 'var(--error)',
                  border: 'none',
                  borderRadius: '3px',
                  color: 'var(--text)',
                  cursor: 'pointer'
                }}
              >
                Stop
              </button>
            )}
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                background: '#3a3a3a',
                border: '1px solid #555',
                borderRadius: '3px',
                color: '#fff',
                cursor: 'pointer'
              }}
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              {isMinimized ? '▲' : '▼'}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  background: '#3a3a3a',
                  border: '1px solid #555',
                  borderRadius: '3px',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Output - only show when not minimized */}
        {!isMinimized && (
          <>
            <div
              ref={outputRef}
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '0.75rem',
                fontSize: '0.7rem',
                fontFamily: 'monospace',
                lineHeight: '1.4',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: '#e0e0e0'
              }}
            >
              {displayLines.length === 0 ? (
                <div style={{ color: '#888' }}>Waiting for output...</div>
              ) : (
                displayLines.map((line, idx) => (
                  <div key={idx}>{line}</div>
                ))
              )}
            </div>

            {/* Interface Selectors */}
            {onStartTest && labHosts && labHosts.length > 0 && (
              <div style={{
                borderTop: '1px solid #444',
                padding: '0.5rem',
                background: '#2a2a2a',
                fontSize: '0.7rem'
              }}>
                {/* 3-column layout: Test type toggle + Start button | Source selector | Dest selector */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {/* Test Type Toggle + Start Button - 1/3 width */}
                  <div style={{ flex: '0 0 calc(33.33% - 0.33rem)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.6rem', color: '#aaa' }}>
                      Actions
                    </label>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <select
                        value={testType}
                        onChange={(e) => setTestType(e.target.value as TestType)}
                        style={{
                          flex: 1,
                          padding: '0.25rem',
                          background: '#3a3a3a',
                          border: '1px solid #555',
                          borderRadius: '3px',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: '0.6rem'
                        }}
                        title="Select test type"
                      >
                        <option value="ping">📡 Ping</option>
                        <option value="traceroute">🔍 Traceroute</option>
                        <option value="iperf">⚡ Iperf</option>
                        <option value="curl">🌐 Curl</option>
                        <option value="hping">🔧 Hping</option>
                      </select>
                      <button
                        onClick={() => onStartTest(srcIp, dstIp, testType)}
                        disabled={!srcIp || !dstIp || isRunning}
                        style={{
                          flex: 1,
                          padding: '0.25rem',
                          fontSize: '0.6rem',
                          fontWeight: '600',
                          background: isRunning ? '#555' : 'var(--accent)',
                          border: 'none',
                          borderRadius: '3px',
                          color: '#fff',
                          cursor: isRunning ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {isRunning ? 'Running...' : 'Start'}
                      </button>
                    </div>
                  </div>

                  {/* Source Selector - 1/3 width */}
                  <div style={{ flex: '0 0 calc(33.33% - 0.33rem)' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.6rem', color: '#aaa' }}>
                      Source
                    </label>
                    <select
                      value={srcIp}
                      onChange={(e) => setSrcIp(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.25rem',
                        background: '#1a1a1a',
                        border: '1px solid #555',
                        borderRadius: '3px',
                        color: '#fff',
                        fontSize: '0.6rem'
                      }}
                    >
                      {labHosts.flatMap(host =>
                        getAllIPs(host).map(({ ip, label }, idx) => (
                          <option key={`${host.name}-${label}-${idx}`} value={ip}>
                            {host.name} - {label}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Destination Selector - 1/3 width */}
                  <div style={{ flex: '0 0 calc(33.33% - 0.33rem)' }}>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.6rem', color: '#aaa' }}>
                      Destination
                    </label>
                    <select
                      value={dstIp}
                      onChange={(e) => setDstIp(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.25rem',
                        background: '#1a1a1a',
                        border: '1px solid #555',
                        borderRadius: '3px',
                        color: '#fff',
                        fontSize: '0.6rem'
                      }}
                    >
                      {labHosts.flatMap(host =>
                        getAllIPs(host).map(({ ip, label }, idx) => (
                          <option key={`${host.name}-${label}-${idx}`} value={ip}>
                            {host.name} - {label}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Resize Handle - only show when not minimized */}
        {!isMinimized && (
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              setResizeStart({
                x: e.clientX,
                y: e.clientY,
                width: size.width,
                height: size.height
              });
              setIsResizing(true);
            }}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '15px',
              height: '15px',
              cursor: 'nwse-resize',
              background: 'linear-gradient(135deg, transparent 50%, #555 50%)',
              borderBottomRightRadius: '6px'
            }}
          />
        )}
      </div>
    );
  }

  // Normal mode rendering
  return (
    <Card className={styles.outputContainer}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
        <h2 style={{ marginTop: 0, marginBottom: 0, flex: 1 }}>
          Test Output
          {viewingTestId ? (
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginLeft: '1rem' }}>
              Viewing: {viewingTestId}
            </span>
          ) : currentTestId && (
            <span style={{ fontSize: '0.875rem', color: isRunning ? 'var(--success)' : 'var(--text-secondary)', marginLeft: '1rem' }}>
              {isRunning && '● '}{currentTestId} {isRunning ? '(running)' : '(finished)'}
            </span>
          )}
        </h2>

        {/* Mode selector */}
        <ButtonGroup>
          <Button
            onClick={() => setOutputMode('clean')}
            className={outputMode === 'clean' ? buttonCss.buttonPrimary : buttonCss.buttonSecondary}
            style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
          >
            Clean
          </Button>
          <Button
            onClick={() => setOutputMode('parsed')}
            className={outputMode === 'parsed' ? buttonCss.buttonPrimary : buttonCss.buttonSecondary}
            style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
          >
            Parsed
          </Button>
          <Button
            onClick={() => setOutputMode('raw')}
            className={outputMode === 'raw' ? buttonCss.buttonPrimary : buttonCss.buttonSecondary}
            style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
          >
            Raw
          </Button>
        </ButtonGroup>

        {viewingTestId && onDisconnect && (
          <Button
            onClick={onDisconnect}
            className={buttonCss.buttonSecondary}
            style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
          >
            Disconnect
          </Button>
        )}
      </div>
      <div ref={outputRef} className={styles.outputPanel}>
        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: 'var(--error-bg)',
            border: '1px solid var(--error)',
            borderRadius: '4px',
            marginBottom: '1rem',
            color: 'var(--error)'
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}
        {output.length === 0 && !error ? (
          <div className={styles.emptyOutput}>
            No output yet. Configure and run a test to see results here.
          </div>
        ) : (
          output.map((line, idx) => {
            const formatted = formatLine(line);
            // Skip empty lines in parsed mode
            if (outputMode === 'parsed' && !formatted) {
              return null;
            }
            return (
              <div key={idx} className={styles.outputLine}>
                {formatted}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};
