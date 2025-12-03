import React, { useState, useEffect } from 'react';
import TopItemsPane from './TopItemsPane';
import { Conversation } from './builderTypes';
import { formatBytes } from '../../../_common/utils/networkUtils';

interface TopConversationsPaneProps {
  conversations: Conversation[];
}

const TopConversationsPane: React.FC<TopConversationsPaneProps> = ({
  conversations
}) => {
  // Manage limit state with localStorage persistence
  const [limit, setLimit] = useState(() => {
    const saved = localStorage.getItem('topConversationsLimit');
    return saved ? parseInt(saved) : 10;
  });

  // Save to localStorage when limit changes
  useEffect(() => {
    localStorage.setItem('topConversationsLimit', limit.toString());
  }, [limit]);
  return (
    <TopItemsPane
      title="Top Conversations"
      data={conversations}
      columns={[
        { key: 'pair', header: 'Conversation' },
        {
          key: 'bytes',
          header: 'Bytes',
          render: (conv) => formatBytes(conv.bytes)
        },
        { key: 'packets', header: 'Packets' },
        { key: 'flows', header: 'Flows' }
      ]}
      limit={limit}
      onLimitChange={setLimit}
      emptyMessage="No conversations detected"
    />
  );
};

export default TopConversationsPane;
