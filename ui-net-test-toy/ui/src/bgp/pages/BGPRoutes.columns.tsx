/**
 * BGP Routes Column Definitions
 */

import React from 'react';
import type { Column } from '../../_common/components/DataTable';
import type { AggregatedRoute } from '../../_common/services/multiClientBgpApi';
import { Button } from '../../_common/components';
import buttonCss from '../../_common/styles/Button.module.css';

/**
 * Get color for RPKI validation status
 */
export const rpkiStatusColor = (status?: string) => {
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

/**
 * Column definitions for BGP routes table
 */
export const createRouteColumns = (
  onWithdraw: (route: AggregatedRoute) => void
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
    key: 'rpki_validation',
    header: 'RPKI',
    render: (route) => (
      <span
        style={{ color: rpkiStatusColor(route.rpki_validation) }}
        title={route.rpki_reason || route.rpki_validation}
      >
        {route.rpki_validation?.toUpperCase() || 'N/A'}
      </span>
    )
  },
  {
    key: 'communities',
    header: 'Communities',
    render: (route) => route.communities?.join(', ') || 'None'
  },
  {
    key: 'actions',
    header: 'Actions',
    render: (route) => (
      <Button className={buttonCss.buttonDelete} onClick={() => onWithdraw(route)}>
        Withdraw
      </Button>
    )
  }
];
