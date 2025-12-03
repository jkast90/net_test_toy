import React from 'react';
import TargetSelector from '../../../_common/components/TargetSelector';

interface BMPConfigurationPaneProps {
  onEnableBMP: () => void;
}

const BMPConfigurationPane: React.FC<BMPConfigurationPaneProps> = ({
  onEnableBMP
}) => {
  return (
    <>
      <TargetSelector label="Configure BMP On:" showDaemonFilter />
      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        <p>Configure BGP Monitoring Protocol on selected daemons</p>
      </div>
    </>
  );
};

export default BMPConfigurationPane;
