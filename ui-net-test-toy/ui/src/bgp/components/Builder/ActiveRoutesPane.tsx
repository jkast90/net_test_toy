import React from 'react';
import { Button, ButtonGroup } from '../../../_common/components';
import DataTable from '../../../_common/components/DataTable';
import type { Column } from '../../../_common/components/DataTable';
import type { AggregatedRoute } from '../../../_common/services/multiClientBgpApi';
import buttonCss from '../../../_common/styles/Button.module.css';

interface ActiveRoutesPaneProps {
  routes: AggregatedRoute[];
  loading: boolean;
  viewMode: 'count' | 'list';
  targets: any[];
  onViewModeChange: (mode: 'count' | 'list') => void;
  onRefresh: () => void;
}

const ActiveRoutesPane: React.FC<ActiveRoutesPaneProps> = ({
  routes,
  loading,
  viewMode,
  targets,
  onViewModeChange,
  onRefresh
}) => {
  const columns: Column<AggregatedRoute>[] = [
    {
      key: 'clientName',
      header: 'Client',
      render: (route) => <strong>{route.clientName}</strong>
    },
    {
      key: 'backend',
      header: 'Daemon',
      render: (route) => route.backend.toUpperCase()
    },
    {
      key: 'prefix',
      header: 'Prefix',
      render: (route) => <strong>{route.prefix}</strong>
    },
    { key: 'next_hop', header: 'Next Hop' },
    {
      key: 'as_path',
      header: 'AS Path',
      render: (route) => route.as_path?.join(' ') || '(empty)'
    },
    {
      key: 'local_pref',
      header: 'Local Pref',
      render: (route) => route.local_pref ?? 'N/A'
    },
    {
      key: 'med',
      header: 'MED',
      render: (route) => route.med ?? 'N/A'
    },
    {
      key: 'communities',
      header: 'Communities',
      render: (route) => route.communities?.join(', ') || 'None'
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <ButtonGroup>
          <Button
            onClick={() => onViewModeChange('count')}
            className={viewMode === 'count' ? buttonCss.buttonPrimary : buttonCss.buttonSecondary}
          >
            Count View
          </Button>
          <Button
            onClick={() => onViewModeChange('list')}
            className={viewMode === 'list' ? buttonCss.buttonPrimary : buttonCss.buttonSecondary}
          >
            List View
          </Button>
        </ButtonGroup>
        <Button
          onClick={onRefresh}
          className={buttonCss.buttonSecondary}
        >
          Refresh
        </Button>
      </div>

      {viewMode === 'count' ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          {routes.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No routes found</p>
          ) : (
            <div>
              <p style={{ fontSize: '3rem', fontWeight: 'bold', margin: '1rem 0', color: 'var(--accent)' }}>
                {routes.length}
              </p>
              <p style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>Total Active Routes</p>
              <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                <p>Routes advertised across all selected clients</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <DataTable
          data={routes}
          columns={columns}
          emptyMessage={targets.length === 0 ? "Select clients to view routes" : "No routes found"}
        />
      )}
    </div>
  );
};

export default ActiveRoutesPane;
