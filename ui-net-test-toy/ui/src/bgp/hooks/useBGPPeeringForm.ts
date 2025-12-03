/**
 * Hook for managing BGP peering form state and submission
 */

import { useState, useCallback } from 'react';
import { configureNeighborOnTargets, ClientDaemonPair } from '../../_common/services/multiClientBgpApi';
import { NeighborAttributes } from '../../_common/services/bgpApi';
import { topologyService } from '../../_common/services/topology/topologyService';
import { DaemonInfo } from './useDaemonFetcher';

interface UseBGPPeeringFormProps {
  saveToTopologyOnly: boolean;
  topologyHostUrl?: string;
  isExternalNodeA: boolean;
  isExternalNodeB: boolean;
  initialSource?: any;
  initialTarget?: any;
  onSuccess?: () => void;
}

export const useBGPPeeringForm = ({
  saveToTopologyOnly,
  topologyHostUrl,
  isExternalNodeA,
  isExternalNodeB,
  initialSource,
  initialTarget,
  onSuccess
}: UseBGPPeeringFormProps) => {
  const [selectedDaemonA, setSelectedDaemonA] = useState<string>('');
  const [selectedInterfaceA, setSelectedInterfaceA] = useState<string>('');
  const [selectedDaemonB, setSelectedDaemonB] = useState<string>('');
  const [selectedInterfaceB, setSelectedInterfaceB] = useState<string>('');
  const [manualIpA, setManualIpA] = useState<string>('');
  const [manualIpB, setManualIpB] = useState<string>('');
  const [manualAsnA, setManualAsnA] = useState<string>('');
  const [manualAsnB, setManualAsnB] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = useCallback(async (
    daemonA: DaemonInfo | undefined,
    daemonB: DaemonInfo | undefined
  ) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    if (!daemonA || !daemonB) {
      setError('Please select both sides');
      setLoading(false);
      return;
    }

    // Validate inputs based on node type
    if (!isExternalNodeA && !selectedInterfaceA) {
      setError('Please select an interface for Router A');
      setLoading(false);
      return;
    }
    if (!isExternalNodeB && !selectedInterfaceB) {
      setError('Please select an interface for Router B');
      setLoading(false);
      return;
    }
    if (isExternalNodeA && !manualIpA) {
      setError('Please enter an IP address for the external node A');
      setLoading(false);
      return;
    }
    if (isExternalNodeB && !manualIpB) {
      setError('Please enter an IP address for the external node B');
      setLoading(false);
      return;
    }

    // Extract IP from interface selection or use manual IP for external nodes
    const localAddressA = isExternalNodeA
      ? manualIpA.trim()
      : selectedInterfaceA.split(':')[1].split('/')[0];
    const localAddressB = isExternalNodeB
      ? manualIpB.trim()
      : selectedInterfaceB.split(':')[1].split('/')[0];

    const neighborIpForA = localAddressB;
    const neighborIpForB = localAddressA;

    // Parse and validate manual ASN values
    const asnA = parseInt(manualAsnA);
    const asnB = parseInt(manualAsnB);

    if (!manualAsnA || isNaN(asnA)) {
      setError('Please enter a valid ASN for Router A');
      setLoading(false);
      return;
    }
    if (!manualAsnB || isNaN(asnB)) {
      setError('Please enter a valid ASN for Router B');
      setLoading(false);
      return;
    }

    try {
      if (saveToTopologyOnly && topologyHostUrl) {
        // Save to topology database only
        const sourceDaemonName = initialSource?.name;
        const targetDaemonName = initialTarget?.name;

        if (!sourceDaemonName || !targetDaemonName) {
          setError(`Missing daemon names in initial data. Source: ${sourceDaemonName}, Target: ${targetDaemonName}`);
          setLoading(false);
          return;
        }

        console.log('[useBGPPeeringForm] Saving BGP peer for', sourceDaemonName, '→', targetDaemonName);

        const result1 = await topologyService.createBGPPeer(
          sourceDaemonName,
          asnA,
          localAddressA,
          localAddressB,
          asnB,
          daemonB.routerId,
          topologyHostUrl
        );

        if (!result1.success) {
          throw new Error(result1.error || 'Failed to create BGP peer for source');
        }

        console.log('[useBGPPeeringForm] Saving BGP peer for', targetDaemonName, '→', sourceDaemonName);

        const result2 = await topologyService.createBGPPeer(
          targetDaemonName,
          asnB,
          localAddressB,
          localAddressA,
          asnA,
          daemonA.routerId,
          topologyHostUrl
        );

        if (!result2.success) {
          throw new Error(result2.error || 'Failed to create BGP peer for target');
        }

        console.log('[useBGPPeeringForm] BGP peering saved successfully for both sides');

        setSuccessMessage(
          `Successfully saved BGP peering to topology: ${sourceDaemonName} ↔ ${targetDaemonName}`
        );
        if (onSuccess) onSuccess();
      } else {
        // Configure BGP directly on daemons
        const neighborsConfiguredA: NeighborAttributes = {
          remote_asn: asnB,
          local_asn: asnA,
          description: `${daemonB.client.name} - ${daemonB.daemon.type}`,
          local_address: localAddressA
        };

        const targetA: ClientDaemonPair = {
          client: daemonA.client,
          daemon: daemonA.daemon
        };

        const resultA = await configureNeighborOnTargets([targetA], neighborIpForA, neighborsConfiguredA);

        const neighborsConfiguredB: NeighborAttributes = {
          remote_asn: asnA,
          local_asn: asnB,
          description: `${daemonA.client.name} - ${daemonA.daemon.type}`,
          local_address: localAddressB
        };

        const targetB: ClientDaemonPair = {
          client: daemonB.client,
          daemon: daemonB.daemon
        };

        const resultB = await configureNeighborOnTargets([targetB], neighborIpForB, neighborsConfiguredB);

        const totalFailed = resultA.failed + resultB.failed;
        const totalSuccess = resultA.success + resultB.success;

        if (totalFailed > 0) {
          const allErrors = [...resultA.errors, ...resultB.errors];
          setError(`Configured ${totalSuccess} sides, failed ${totalFailed}: ${allErrors.join(', ')}`);
        } else {
          setSuccessMessage(
            `Successfully configured peering: ${localAddressA} (${daemonA.client.name}/${daemonA.daemon.type}) ↔ ${localAddressB} (${daemonB.client.name}/${daemonB.daemon.type})`
          );
          setSelectedDaemonA('');
          setSelectedInterfaceA('');
          setSelectedDaemonB('');
          setSelectedInterfaceB('');
          if (onSuccess) onSuccess();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save BGP peer');
    } finally {
      setLoading(false);
    }
  }, [
    isExternalNodeA,
    isExternalNodeB,
    selectedInterfaceA,
    selectedInterfaceB,
    manualIpA,
    manualIpB,
    manualAsnA,
    manualAsnB,
    saveToTopologyOnly,
    topologyHostUrl,
    initialSource,
    initialTarget,
    onSuccess
  ]);

  return {
    selectedDaemonA,
    setSelectedDaemonA,
    selectedInterfaceA,
    setSelectedInterfaceA,
    selectedDaemonB,
    setSelectedDaemonB,
    selectedInterfaceB,
    setSelectedInterfaceB,
    manualIpA,
    setManualIpA,
    manualIpB,
    setManualIpB,
    manualAsnA,
    setManualAsnA,
    manualAsnB,
    setManualAsnB,
    loading,
    error,
    successMessage,
    handleSubmit
  };
};
