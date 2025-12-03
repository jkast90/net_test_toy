import React from 'react';
import TargetSelector from '../../../_common/components/TargetSelector';

const NetFlowConfigurationPane: React.FC = () => {
  return (
    <>
      <TargetSelector />
      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        <p>Configure NetFlow export on selected BGP daemons</p>
      </div>
    </>
  );
};

export default NetFlowConfigurationPane;
