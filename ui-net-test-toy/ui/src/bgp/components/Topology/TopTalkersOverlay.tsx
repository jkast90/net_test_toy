/**
 * Top Talkers Overlay Component
 * Shows top talkers from NetFlow data in a canvas overlay pane
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useAppSelector } from '../../../_common/store/hooks';
import { makeSelectTopTalkers } from '../../../_common/store/netflowSelectors';
import { formatBytes } from '../../../_common/utils/networkUtils';
import { CanvasOverlayPane } from './CanvasOverlayPane';
import { RootState } from '../../../_common/store/store';

interface TopTalkersOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

// Format bits per second to human readable format
const formatRate = (bps: number): string => {
  if (bps === 0) return '-';
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(1)} Gbps`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} Kbps`;
  return `${bps.toFixed(0)} bps`;
};

export const TopTalkersOverlay: React.FC<TopTalkersOverlayProps> = ({
  isOpen,
  onClose
}) => {
  const [count, setCount] = useState(10);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Create selector based on count
  const selectTopTalkers = useMemo(() => makeSelectTopTalkers(count), [count]);
  // Pass currentTime to force recalculation when aging
  const topTalkers = useAppSelector((state) => selectTopTalkers(state, currentTime));
  const wsConnected = useAppSelector((state: RootState) => state.netflow.wsConnected);

  // Periodic refresh to age out stale talkers (every 5 seconds)
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= 100) {
      setCount(value);
    }
  };

  return (
    <CanvasOverlayPane
      title="Top Talkers"
      isOpen={isOpen}
      onClose={onClose}
      minimizedOffset="right"
      defaultSize={{ width: 400, height: 300 }}
      defaultPosition={{ x: 50, y: 50 }}
      headerActions={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.7rem', color: '#aaa' }}>Count:</label>
          <input
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={handleCountChange}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: '40px',
              padding: '0.15rem 0.25rem',
              fontSize: '0.7rem',
              background: '#3a3a3a',
              border: '1px solid #555',
              borderRadius: '3px',
              color: '#fff',
              textAlign: 'center'
            }}
          />
        </div>
      }
    >
      <div style={{
        padding: '0.5rem',
        fontSize: '0.75rem',
        fontFamily: 'monospace',
        color: '#e0e0e0'
      }}>
        {topTalkers.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            color: '#888'
          }}>
            {wsConnected ? (
              <>
                <span style={{ color: '#4CAF50' }}>● Connected</span> — No flows yet
                <br />
                <span style={{ fontSize: '0.65rem' }}>
                  Waiting for traffic through configured taps.
                </span>
              </>
            ) : (
              <>
                <span style={{ color: '#f44336' }}>● Disconnected</span>
                <br />
                <span style={{ fontSize: '0.65rem' }}>
                  Configure NetFlow taps to see traffic.
                </span>
              </>
            )}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #444' }}>
                <th style={{ textAlign: 'left', padding: '0.25rem', color: '#aaa' }}>Address</th>
                <th style={{ textAlign: 'right', padding: '0.25rem', color: '#aaa' }}>Bytes</th>
                <th style={{ textAlign: 'right', padding: '0.25rem', color: '#aaa' }}>Rate</th>
                <th style={{ textAlign: 'right', padding: '0.25rem', color: '#aaa' }}>Pkts</th>
              </tr>
            </thead>
            <tbody>
              {topTalkers.map((talker, index) => (
                <tr
                  key={talker.address}
                  style={{
                    borderBottom: '1px solid #333',
                    background: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'
                  }}
                >
                  <td style={{ padding: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                    {talker.address}
                  </td>
                  <td style={{ textAlign: 'right', padding: '0.25rem', color: '#4CAF50' }}>
                    {formatBytes(talker.bytes)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '0.25rem', color: '#FF9800' }}>
                    {formatRate(talker.avgBps)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '0.25rem', color: '#2196F3' }}>
                    {talker.packets.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </CanvasOverlayPane>
  );
};
