import React from 'react';
import { DashboardPane } from './DashboardPane';
import Button from './ui/Button';
import Alert from './ui/Alert';
import TargetSelector from './TargetSelector';
import buttonCss from '../styles/Button.module.css';

interface ConfigurationPaneProps {
  title?: string;
  serviceName: string;
  onConfigure: () => void | Promise<void>;
  configuring: boolean;
  configMessage: string | null;
  onClearMessage: () => void;
  targetsCount: number;
  showDaemonFilter?: boolean;
  targetSelectorLabel?: string;
  disabled?: boolean;
}

export const ConfigurationPane: React.FC<ConfigurationPaneProps> = ({
  title,
  serviceName,
  onConfigure,
  configuring,
  configMessage,
  onClearMessage,
  targetsCount,
  showDaemonFilter = false,
  targetSelectorLabel,
  disabled = false
}) => {
  const paneTitle = title || `${serviceName} Configuration`;
  const buttonLabel = configuring ? 'Configuring...' : 'Configure';
  const selectorLabel = targetSelectorLabel || `Configure ${serviceName} On:`;

  return (
    <DashboardPane
      title={paneTitle}
      actions={
        <Button
          onClick={onConfigure}
          disabled={disabled || configuring || targetsCount === 0}
          className={buttonCss.buttonPrimary}
        >
          {buttonLabel}
        </Button>
      }
    >
      <TargetSelector
        label={selectorLabel}
        showDaemonFilter={showDaemonFilter}
      />
      {configMessage && (
        <Alert
          type={configMessage.includes('failed') ? 'error' : 'success'}
          message={configMessage}
          onClose={onClearMessage}
        />
      )}
    </DashboardPane>
  );
};

export default ConfigurationPane;
