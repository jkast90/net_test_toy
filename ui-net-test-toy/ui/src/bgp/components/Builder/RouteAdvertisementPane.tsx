/**
 * Route Advertisement Pane
 * Provides interface for announcing BGP routes to selected clients
 */

import React from 'react';
import { Alert } from '../../../_common/components';

interface RouteAdvertisementPaneProps {
  targetCount: number;
  onAdvertiseRoute: () => void;
}

const RouteAdvertisementPane: React.FC<RouteAdvertisementPaneProps> = ({
  targetCount,
  onAdvertiseRoute
}) => {
  return (
    <>
      {targetCount === 0 ? (
        <Alert type="info" message="No clients selected. Please select clients in Connection Manager to view routes." />
      ) : (
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          <p>Click "Advertise Route" to announce a new BGP prefix to selected clients.</p>
          <p style={{ marginTop: '0.5rem' }}>Routes are propagated with full BGP attributes including AS path, communities, and local preference.</p>
        </div>
      )}
    </>
  );
};

export default RouteAdvertisementPane;
