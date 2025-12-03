/**
 * BMP Routes Pane
 * Displays BMP-monitored routes (advertised and received)
 */

import React, { useState } from 'react';
import { DashboardPane, EmptyState, Button, ButtonGroup } from '../../../_common/components';
import DataTable from '../../../_common/components/DataTable';
import type { Column } from '../../../_common/components/DataTable';
import { BMPRoute } from '../../../_common/types/bmp';
import buttonCss from '../../../_common/styles/Button.module.css';

interface BMPRoutesPaneProps {
  routes: Record<string, { advertised: BMPRoute[]; received: BMPRoute[] }> | undefined;
  loading?: boolean;
  limit?: number; // Optional limit for dashboard summary mode
}

export const BMPRoutesPane: React.FC<BMPRoutesPaneProps> = ({
  routes,
  loading = false,
  limit
}) => {
  const [routeType, setRouteType] = useState<'advertised' | 'received'>('received');
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);

  // Get all routes of the selected type - handle undefined/null routes
  const allRoutes: BMPRoute[] = routes
    ? Object.entries(routes).flatMap(([peer, data]) =>
        data[routeType].map(route => ({ ...route, peer }))
      )
    : [];

  const displayedRoutes = limit ? allRoutes.slice(0, limit) : allRoutes;
  const peerList = routes ? Object.keys(routes) : [];

  // Filter by selected peer if one is selected
  const filteredRoutes = selectedPeer
    ? displayedRoutes.filter((route: any) => route.peer === selectedPeer)
    : displayedRoutes;

  const routeColumns: Column<BMPRoute>[] = [
    {
      key: 'prefix',
      header: 'Prefix',
      render: (route) => route.prefix
    },
    {
      key: 'next_hop',
      header: 'Next Hop',
      render: (route) => route.next_hop
    },
    {
      key: 'as_path',
      header: 'AS Path',
      render: (route) => route.as_path?.join(' ') || '-'
    },
    {
      key: 'local_pref',
      header: 'Local Pref',
      render: (route) => route.local_pref?.toString() || '-'
    },
    {
      key: 'timestamp',
      header: 'Timestamp',
      render: (route) => new Date(route.timestamp).toLocaleString()
    }
  ];

  const title = limit
    ? `BMP Routes - ${routeType} (${filteredRoutes.length}${allRoutes.length > (limit || 0) ? ` of ${allRoutes.length}` : ''})`
    : `BMP Routes - ${routeType} (${filteredRoutes.length})`;

  return (
    <DashboardPane
      title={title}
      loading={loading}
      actions={
        <ButtonGroup>
          <Button
            onClick={() => setRouteType('advertised')}
            className={routeType === 'advertised' ? buttonCss.buttonPrimary : buttonCss.buttonSecondary}
          >
            Advertised
          </Button>
          <Button
            onClick={() => setRouteType('received')}
            className={routeType === 'received' ? buttonCss.buttonPrimary : buttonCss.buttonSecondary}
          >
            Received
          </Button>
        </ButtonGroup>
      }
    >
      {peerList.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginRight: '0.5rem' }}>
            Filter by Peer:
          </label>
          <select
            value={selectedPeer || ''}
            onChange={(e) => setSelectedPeer(e.target.value || null)}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--background)',
              color: 'var(--text-primary)'
            }}
          >
            <option value="">All Peers</option>
            {peerList.map(peer => (
              <option key={peer} value={peer}>{peer}</option>
            ))}
          </select>
        </div>
      )}

      {filteredRoutes.length === 0 ? (
        <EmptyState message={`No ${routeType} routes available`} />
      ) : (
        <DataTable
          data={filteredRoutes}
          columns={routeColumns}
          emptyMessage={`No ${routeType} routes`}
        />
      )}
    </DashboardPane>
  );
};

export default BMPRoutesPane;
