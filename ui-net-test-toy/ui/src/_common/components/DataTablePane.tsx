import React from 'react';
import { DashboardPane } from './DashboardPane';
import DataTable from './DataTable';
import type { Column } from './DataTable';

interface DataTablePaneProps<T> {
  title: string;
  data: T[];
  columns: Column<T>[];
  emptyMessage?: string;
  actions?: React.ReactNode;
  loading?: boolean;
  showCount?: boolean;
  className?: string;
  width?: string;
}

export function DataTablePane<T>({
  title,
  data,
  columns,
  emptyMessage = 'No data available',
  actions,
  loading = false,
  showCount = true,
  className,
  width
}: DataTablePaneProps<T>) {
  const displayTitle = showCount && data.length > 0
    ? `${title} (${data.length})`
    : title;

  return (
    <DashboardPane
      title={displayTitle}
      actions={actions}
      loading={loading}
      className={className}
      width={width}
    >
      <DataTable
        data={data}
        columns={columns}
        emptyMessage={emptyMessage}
      />
    </DashboardPane>
  );
}

export default DataTablePane;
