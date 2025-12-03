/**
 * Refactored Smart Neighbor Form
 * Simplified version using extracted hooks
 */

import React, { useEffect } from 'react';
import { useAppSelector } from '../../_common/store/hooks';
import { selectAllClients } from '../../_common/store/connectionSelectors';
import { Button } from '../../_common/components/ui';
import buttonCss from '../../_common/styles/Button.module.css';
import styles from './Forms.module.css';
import { useLabManager } from '../../_common/hooks/useLabManager';
import { useDaemonFetcher, useBGPPeeringForm, type DaemonInfo } from '../hooks';
import { DaemonSelector, InterfaceSelector, ASNInput } from './SmartNeighborForm/index';

interface SmartNeighborFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  saveToTopologyOnly?: boolean;
  topologyHostUrl?: string;
  initialSource?: {
    router_id: string;
    daemon_type: string;
    type?: string;
    interfaces?: Array<{ network: string; ipv4: string; gateway: string }>;
  };
  initialTarget?: {
    router_id: string;
    daemon_type: string;
    type?: string;
    interfaces?: Array<{ network: string; ipv4: string; gateway: string }>;
  };
}

const SmartNeighborForm: React.FC<SmartNeighborFormProps> = ({
  onSuccess,
  onCancel,
  saveToTopologyOnly = false,
  topologyHostUrl,
  initialSource,
  initialTarget
}) => {
  const clients = useAppSelector(selectAllClients);
  const { managedHosts, selectedHostId } = useLabManager();
  const currentHostUrl = managedHosts.find(h => h.id === selectedHostId)?.url || '';

  const isExternalNodeA = initialSource?.type === 'external_node';
  const isExternalNodeB = initialTarget?.type === 'external_node';

  // Use daemon fetcher hook
  const { availableDaemons, fetchingDaemons, getDaemonByUniqueKey } = useDaemonFetcher({
    clients,
    currentHostUrl,
    saveToTopologyOnly,
    topologyHostUrl,
    initialSource,
    initialTarget
  });

  // Use BGP peering form hook
  const formHook = useBGPPeeringForm({
    saveToTopologyOnly,
    topologyHostUrl,
    isExternalNodeA,
    isExternalNodeB,
    initialSource,
    initialTarget,
    onSuccess
  });

  // Auto-populate daemon selections when initial values are provided
  useEffect(() => {
    if (!initialSource || !initialTarget || availableDaemons.length === 0) {
      return;
    }

    const sourceType = initialSource.daemon_type || initialSource.type || 'unknown';
    const targetType = initialTarget.daemon_type || initialTarget.type || 'unknown';

    // Find matching daemons
    const sourceDaemon = availableDaemons.find(d =>
      d.routerId === initialSource.router_id &&
      d.daemon.type === sourceType
    );

    const targetDaemon = availableDaemons.find(d =>
      d.routerId === initialTarget.router_id &&
      d.daemon.type === targetType
    );

    if (sourceDaemon) {
      const sourceKey = `${sourceDaemon.client.id}-${sourceDaemon.daemon.type}-${sourceDaemon.routerId}`;
      formHook.setSelectedDaemonA(sourceKey);

      // Set ASN if available
      if (sourceDaemon.asn && !formHook.manualAsnA) {
        formHook.setManualAsnA(sourceDaemon.asn.toString());
      }
    }

    if (targetDaemon) {
      const targetKey = `${targetDaemon.client.id}-${targetDaemon.daemon.type}-${targetDaemon.routerId}`;
      formHook.setSelectedDaemonB(targetKey);

      // Set ASN if available
      if (targetDaemon.asn && !formHook.manualAsnB) {
        formHook.setManualAsnB(targetDaemon.asn.toString());
      }
    }
  }, [initialSource, initialTarget, availableDaemons]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-set ASN when daemon is selected
  useEffect(() => {
    const daemonA = getDaemonByUniqueKey(formHook.selectedDaemonA);
    if (daemonA?.asn && !formHook.manualAsnA) {
      formHook.setManualAsnA(daemonA.asn.toString());
    }
  }, [formHook.selectedDaemonA]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const daemonB = getDaemonByUniqueKey(formHook.selectedDaemonB);
    if (daemonB?.asn && !formHook.manualAsnB) {
      formHook.setManualAsnB(daemonB.asn.toString());
    }
  }, [formHook.selectedDaemonB]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const daemonA = getDaemonByUniqueKey(formHook.selectedDaemonA);
    const daemonB = getDaemonByUniqueKey(formHook.selectedDaemonB);
    formHook.handleSubmit(daemonA, daemonB);
  };

  const daemonA = getDaemonByUniqueKey(formHook.selectedDaemonA);
  const daemonB = getDaemonByUniqueKey(formHook.selectedDaemonB);

  return (
    <form onSubmit={handleFormSubmit} className={styles.form}>
      <h3>Configure BGP Peering</h3>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Fill in the information below to set up a BGP peering.
      </p>

      {fetchingDaemons && (
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading available daemons...
        </div>
      )}

      {!fetchingDaemons && availableDaemons.length < 2 && (
        <div className={styles.warning}>
          At least 2 connected BGP daemons are required. Please ensure clients are connected in Connection Manager.
        </div>
      )}

      {!fetchingDaemons && availableDaemons.length >= 2 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            {/* Row 1: Headers */}
            <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Daemon</div>
            <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Interface</div>
            <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-muted)' }}>ASN</div>

            {/* Row 2: Router A */}
            <DaemonSelector
              id="daemonA"
              label="Router A"
              value={formHook.selectedDaemonA}
              onChange={(value) => {
                formHook.setSelectedDaemonA(value);
                formHook.setSelectedInterfaceA('');
              }}
              availableDaemons={availableDaemons}
              disabledValue={formHook.selectedDaemonB}
            />

            <InterfaceSelector
              id="interfaceA"
              label={isExternalNodeA ? 'IP Address A' : 'Interface A'}
              isExternalNode={isExternalNodeA}
              manualIp={formHook.manualIpA}
              onManualIpChange={formHook.setManualIpA}
              selectedInterface={formHook.selectedInterfaceA}
              onInterfaceChange={formHook.setSelectedInterfaceA}
              daemon={daemonA}
              daemonSelected={!!formHook.selectedDaemonA}
            />

            <ASNInput
              id="asnA"
              label="ASN A"
              value={formHook.manualAsnA}
              onChange={formHook.setManualAsnA}
            />

            {/* Row 3: Router B */}
            <DaemonSelector
              id="daemonB"
              label="Router B"
              value={formHook.selectedDaemonB}
              onChange={(value) => {
                formHook.setSelectedDaemonB(value);
                formHook.setSelectedInterfaceB('');
              }}
              availableDaemons={availableDaemons}
              disabledValue={formHook.selectedDaemonA}
            />

            <InterfaceSelector
              id="interfaceB"
              label={isExternalNodeB ? 'IP Address B' : 'Interface B'}
              isExternalNode={isExternalNodeB}
              manualIp={formHook.manualIpB}
              onManualIpChange={formHook.setManualIpB}
              selectedInterface={formHook.selectedInterfaceB}
              onInterfaceChange={formHook.setSelectedInterfaceB}
              daemon={daemonB}
              daemonSelected={!!formHook.selectedDaemonB}
            />

            <ASNInput
              id="asnB"
              label="ASN B"
              value={formHook.manualAsnB}
              onChange={formHook.setManualAsnB}
            />
          </div>
        </>
      )}

      {formHook.error && <div className={styles.error}>{formHook.error}</div>}
      {formHook.successMessage && <div className={styles.success}>{formHook.successMessage}</div>}

      <div className={buttonCss.buttonGroup}>
        <Button
          type="submit"
          disabled={
            formHook.loading ||
            !formHook.selectedDaemonA ||
            !formHook.selectedDaemonB ||
            (!isExternalNodeA && !formHook.selectedInterfaceA) ||
            (!isExternalNodeB && !formHook.selectedInterfaceB) ||
            (isExternalNodeA && !formHook.manualIpA) ||
            (isExternalNodeB && !formHook.manualIpB) ||
            fetchingDaemons
          }
          className={buttonCss.buttonPrimary}
        >
          {formHook.loading ? 'Configuring...' : 'Configure Peering'}
        </Button>
        {onCancel && (
          <Button
            type="button"
            onClick={onCancel}
            className={buttonCss.buttonSecondary}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
};

export default SmartNeighborForm;
