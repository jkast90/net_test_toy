/**
 * Active Routes Pane Component
 * Displays table of active BGP routes with RPKI validation
 */

import React from 'react';
import type { AggregatedRoute } from '../../../_common/services/multiClientBgpApi';
import { DataTablePane } from '../../../_common/components';
import { createRouteColumns } from '../../pages/BGPRoutes.columns';

interface ActiveRoutesPaneProps {
  routes: AggregatedRoute[];
  loading: boolean;
  onWithdraw: (route: AggregatedRoute) => void;
}

/**
 * Displays active BGP routes in a table with withdrawal actions
 */
export const ActiveRoutesPane: React.FC<ActiveRoutesPaneProps> = ({
  routes,
  loading,
  onWithdraw
}) => {
  const columns = createRouteColumns(onWithdraw);

  return (
    <DataTablePane
      title="Active Routes"
      data={routes}
      columns={columns}
      emptyMessage="No routes found. Advertise a route to get started."
      loading={loading}
    />
  );
};
