import React from 'react';
import { Button } from '../../_common/components';
import type { Column } from '../../_common/components/DataTable';
import type { AggregatedRoute } from '../../_common/services/multiClientBgpApi';

const rpkiStatusColor = (status?: string) => {
  if (!status) return 'var(--text-muted)';
  switch (status) {
    case 'valid':
      return 'var(--success)';
    case 'invalid':
      return 'var(--error)';
    case 'not_found':
      return 'var(--warning)';
    default:
      return 'var(--text-muted)';
  }
};

export const createRouteColumns = (
  onWithdraw: (route: AggregatedRoute) => void,
  deletingRoutes: string[]
): Column<AggregatedRoute>[] => [
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
    key: 'origin',
    header: 'Origin',
    render: (route) => (
      <span
        title={`Originating AS: ${route.origin}`}
        style={{ color: 'var(--info)' }}
      >
        AS {route.origin}
      </span>
    )
  },
  {
    key: 'rpki_validation',
    header: 'RPKI',
    render: (route) => (
      <span
        style={{
          color: rpkiStatusColor(route.rpki_validation),
          fontWeight: 500,
          fontSize: '0.875rem'
        }}
      >
        {route.rpki_validation || 'unknown'}
      </span>
    )
  },
  {
    key: 'actions',
    header: 'Actions',
    render: (route) => (
      <Button
        size="small"
        variant="danger"
        onClick={() => onWithdraw(route)}
        disabled={deletingRoutes.includes(route.prefix)}
      >
        {deletingRoutes.includes(route.prefix) ? 'Withdrawing...' : 'Withdraw'}
      </Button>
    )
  }
];
