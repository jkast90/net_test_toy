import React, { useState } from 'react';
import { Button, DashboardPane, DataTablePane, ButtonGroup } from '../../../_common/components';
import buttonCss from '../../../_common/styles/Button.module.css';
import styles from '../../pages/SharedBGPPages.module.css';
import BaseDialog from '../../../_common/components/ui/BaseDialog';
import { RouteAdvertisementForm } from '../../components';
import type { AggregatedRoute } from '../../../_common/services/multiClientBgpApi';
import type { Column } from '../../../_common/components/DataTable';

interface BGPRoutesPaneProps {
  routes: AggregatedRoute[];
  loading: boolean;
  columns: Column<AggregatedRoute>[];
  onRouteAdvertised: () => void;
}

const BGPRoutesPane: React.FC<BGPRoutesPaneProps> = ({
  routes,
  loading,
  columns,
  onRouteAdvertised
}) => {
  const [routeViewMode, setRouteViewMode] = useState<'count' | 'list'>('list');
  const [isAdvertiseDialogOpen, setIsAdvertiseDialogOpen] = useState(false);

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>BGP Routes</h2>
        <div className={styles.headerActions}>
          <ButtonGroup>
            <Button
              onClick={() => setRouteViewMode('list')}
              variant={routeViewMode === 'list' ? 'primary' : 'secondary'}
            >
              List View
            </Button>
            <Button
              onClick={() => setRouteViewMode('count')}
              variant={routeViewMode === 'count' ? 'primary' : 'secondary'}
            >
              Count View
            </Button>
          </ButtonGroup>
          <Button
            className={buttonCss.buttonPrimary}
            onClick={() => setIsAdvertiseDialogOpen(true)}
          >
            Advertise Route
          </Button>
        </div>
      </div>

      {isAdvertiseDialogOpen && (
        <BaseDialog
          open={isAdvertiseDialogOpen}
          onClose={() => setIsAdvertiseDialogOpen(false)}
          title="Advertise BGP Route"
        >
          <RouteAdvertisementForm
            onSuccess={() => {
              setIsAdvertiseDialogOpen(false);
              onRouteAdvertised();
            }}
            onClose={() => setIsAdvertiseDialogOpen(false)}
          />
        </BaseDialog>
      )}

      {routeViewMode === 'list' ? (
        <DataTablePane
          title=""
          data={routes}
          columns={columns}
          loading={loading}
          emptyMessage="No BGP routes found"
        />
      ) : (
        <DashboardPane
          title=""
          stats={[
            {
              label: 'Total Routes',
              value: routes.length.toString(),
              icon: '🌐'
            },
            {
              label: 'Unique Prefixes',
              value: [...new Set(routes.map(r => r.prefix))].length.toString(),
              icon: '📍'
            },
            {
              label: 'RPKI Valid',
              value: routes.filter(r => r.rpki_validation === 'valid').length.toString(),
              icon: '✅'
            },
            {
              label: 'RPKI Invalid',
              value: routes.filter(r => r.rpki_validation === 'invalid').length.toString(),
              icon: '❌'
            }
          ]}
        />
      )}
    </div>
  );
};

export default BGPRoutesPane;
