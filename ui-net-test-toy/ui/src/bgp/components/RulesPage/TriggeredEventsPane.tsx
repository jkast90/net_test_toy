import React from 'react';
import { DashboardPane, EmptyState } from '../../../_common/components';
import { TriggeredEventsTable } from '../FlowRules';
import { PROTOCOL_NAMES } from '../../../_common/utils/networkUtils';

interface TriggeredEventsPaneProps {
  events: any[];
  loading?: boolean;
  limit?: number; // Optional limit for dashboard summary mode
}

const TriggeredEventsPane: React.FC<TriggeredEventsPaneProps> = ({
  events,
  loading = false,
  limit
}) => {
  const displayedEvents = limit ? events.slice(0, limit) : events;
  const title = limit
    ? `Triggered Events (${displayedEvents.length}${events.length > limit ? ` of ${events.length}` : ''})`
    : `Triggered Events (${events.length})`;

  return (
    <DashboardPane title={title} loading={loading}>
      {events.length === 0 ? (
        <EmptyState message="No triggered events" />
      ) : (
        <TriggeredEventsTable events={displayedEvents} protocols={PROTOCOL_NAMES} />
      )}
    </DashboardPane>
  );
};

export default TriggeredEventsPane;
