import React, { useState } from 'react';
import { DashboardPane, Button, Alert } from '../../../_common/components';
import { ButtonGroup, BaseDialog } from '../../../_common/components/ui';
import RouteAdvertisementForm from '../RouteAdvertisementForm';

interface RouteAdvertisementPaneProps {
  onRefresh: () => void;
  onSuccess: () => void;
  showEmptyAlert?: boolean;
}

const RouteAdvertisementPane: React.FC<RouteAdvertisementPaneProps> = ({
  onRefresh,
  onSuccess,
  showEmptyAlert = false
}) => {
  const [showForm, setShowForm] = useState(false);

  const handleSuccess = () => {
    setShowForm(false);
    onSuccess();
  };

  return (
    <DashboardPane
      title="Route Advertisement"
      actions={
        <ButtonGroup>
          <Button
            onClick={() => setShowForm(true)}
            className="buttonPrimary"
          >
            Advertise Route
          </Button>
          <Button
            onClick={onRefresh}
            className="buttonSecondary"
          >
            Refresh
          </Button>
        </ButtonGroup>
      }
    >
      {showEmptyAlert ? (
        <Alert type="info" message="No clients selected. Please select clients in Connection Manager to view routes." />
      ) : (
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          <p>Click "Advertise Route" to announce a new BGP prefix to selected clients.</p>
          <p style={{ marginTop: '0.5rem' }}>Routes are propagated with full BGP attributes including AS path, communities, and local preference.</p>
        </div>
      )}

      <BaseDialog open={showForm} onClose={() => setShowForm(false)}>
        <RouteAdvertisementForm
          onSuccess={handleSuccess}
          onCancel={() => setShowForm(false)}
        />
      </BaseDialog>
    </DashboardPane>
  );
};

export default RouteAdvertisementPane;
