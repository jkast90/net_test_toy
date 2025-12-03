import React, { useState } from 'react';
import type { AggregatedRoute } from '../../_common/services/multiClientBgpApi';
import { useAppSelector } from '../../_common/store/hooks';
import { selectEnabledDaemonsForSelectedClients } from '../../_common/store/connectionSelectors';
import { useRoutes, useRouteOperations } from '../../_common/hooks';
import { ActiveRoutesPane, RouteAdvertisementPane } from '../components/BGPRoutes';
import { Alert, PageLayout } from '../../_common/components';
import { ConfirmDeleteDialog } from '../../_common/components/dialogs';
import { NavBarPageHeader } from '../../_common/components/layout';

const BGPRoutes: React.FC = () => {
  const targets = useAppSelector(selectEnabledDaemonsForSelectedClients);

  // Use hooks for data and operations - hook handles refetch internally
  const { routes, loading, error, refetch } = useRoutes(targets);
  const { withdrawRoute, withdrawError, withdrawSuccess, resetWithdraw } = useRouteOperations({
    onRouteChanged: refetch
  });

  // UI state only
  const [withdrawTarget, setWithdrawTarget] = useState<AggregatedRoute | null>(null);

  // Handler just calls hook method - hook handles refetch internally
  const handleWithdraw = (route: AggregatedRoute) => {
    withdrawRoute({ route, targets });
    setWithdrawTarget(null);
  };

  return (
    <PageLayout>
      <NavBarPageHeader
        title="BGP Routes"
        subtitle="Advertise and manage BGP routes across multiple clients with RPKI validation"
      />
      {error && <Alert type="error" message={error} />}
      {withdrawError && <Alert type="error" message={withdrawError.message} onClose={resetWithdraw} />}
      {withdrawSuccess && <Alert type="success" message="Route withdrawn successfully" onClose={resetWithdraw} />}

      <RouteAdvertisementPane
        onRefresh={refetch}
        onSuccess={refetch}
        showEmptyAlert={targets.length === 0}
      />

      <ActiveRoutesPane
        routes={routes}
        loading={loading}
        onWithdraw={setWithdrawTarget}
      />

      <ConfirmDeleteDialog
        open={withdrawTarget !== null}
        onClose={() => setWithdrawTarget(null)}
        onConfirm={() => {
          if (withdrawTarget) {
            handleWithdraw(withdrawTarget);
          }
        }}
        itemName={withdrawTarget ? `route ${withdrawTarget.prefix} from ${withdrawTarget.clientName} (${withdrawTarget.backend})` : ''}
      />
    </PageLayout>
  );
};

export default BGPRoutes;
