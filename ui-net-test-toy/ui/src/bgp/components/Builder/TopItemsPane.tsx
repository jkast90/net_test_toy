import React from 'react';
import DataTable, { Column } from '../../../_common/components/DataTable';

interface TopItemsPaneProps<T> {
  title: string;
  data: T[];
  columns: Column<T>[];
  limit: number;
  onLimitChange: (limit: number) => void;
  emptyMessage?: string;
  minLimit?: number;
  maxLimit?: number;
}

/**
 * Reusable pane for displaying "Top N" items with a limit input control
 * Consolidates TopTalkersPane, TopConversationsPane, and TopBandwidthFlowsPane
 */
function TopItemsPane<T>({
  title,
  data,
  columns,
  limit,
  onLimitChange,
  emptyMessage = 'No data available',
  minLimit = 1,
  maxLimit = 50
}: TopItemsPaneProps<T>) {
  return (
    <DataTable
      data={data}
      columns={columns}
      emptyMessage={emptyMessage}
    />
  );
}

export default TopItemsPane;
