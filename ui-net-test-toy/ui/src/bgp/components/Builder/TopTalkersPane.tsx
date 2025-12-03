import React, { useState, useEffect } from 'react';
import TopItemsPane from './TopItemsPane';
import { TopTalker } from './builderTypes';
import { formatBytes } from '../../../_common/utils/networkUtils';

interface TopTalkersPaneProps {
  topTalkers: TopTalker[];
}

const TopTalkersPane: React.FC<TopTalkersPaneProps> = ({
  topTalkers
}) => {
  // Manage limit state with localStorage persistence
  const [limit, setLimit] = useState(() => {
    const saved = localStorage.getItem('topTalkersLimit');
    return saved ? parseInt(saved) : 10;
  });

  // Save to localStorage when limit changes
  useEffect(() => {
    localStorage.setItem('topTalkersLimit', limit.toString());
  }, [limit]);
  return (
    <TopItemsPane
      title="Top Talkers (by Bytes)"
      data={topTalkers}
      columns={[
        { key: 'address', header: 'Address' },
        {
          key: 'bytes',
          header: 'Bytes',
          render: (talker) => formatBytes(talker.bytes)
        },
        { key: 'packets', header: 'Packets' },
        { key: 'flows', header: 'Flows' }
      ]}
      limit={limit}
      onLimitChange={setLimit}
      emptyMessage="No traffic data available"
    />
  );
};

export default TopTalkersPane;
