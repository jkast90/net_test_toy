/**
 * Topology Panel Actions Hook
 * Handles deploy, stop, and edit actions for daemons, hosts, networks, and BGP sessions
 */

import { useCallback } from 'react';
import { topologyService } from '../../_common/services/topology/topologyService';

export interface UseTopologyPanelActionsOptions {
  containerManagerUrl: string;
  appConfig: any;
  refetchConfig: () => void;
}

export const useTopologyPanelActions = (options: UseTopologyPanelActionsOptions) => {
  const { containerManagerUrl, appConfig, refetchConfig } = options;

  // Daemon actions
  const deployDaemon = useCallback(async (name: string) => {
    try {
      const result = await topologyService.deployDaemon(name, containerManagerUrl);
      if (!result.success) {
        throw new Error(result.error || 'Failed to deploy daemon');
      }
      alert(`Daemon ${name} deployed successfully`);
      refetchConfig();
    } catch (error) {
      alert(`Failed to deploy daemon: ${error}`);
    }
  }, [containerManagerUrl, refetchConfig]);

  const stopDaemon = useCallback(async (name: string) => {
    try {
      if (!confirm(`Remove container for daemon ${name}? It will remain in the topology and can be redeployed.`)) {
        return;
      }
      const response = await fetch(`${containerManagerUrl}/daemons/${name}/stop`, {
        method: 'POST'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to remove daemon container');
      }
      alert(`Daemon ${name} container removed successfully`);
      refetchConfig();
    } catch (error) {
      alert(`Failed to remove daemon container: ${error}`);
    }
  }, [containerManagerUrl, refetchConfig]);

  // Host actions
  const deployHost = useCallback(async (name: string) => {
    try {
      const result = await topologyService.deployHost(name, containerManagerUrl);
      if (!result.success) {
        throw new Error(result.error || 'Failed to deploy host');
      }
      alert(`Host ${name} deployed successfully`);
      refetchConfig();
    } catch (error) {
      alert(`Failed to deploy host: ${error}`);
    }
  }, [containerManagerUrl, refetchConfig]);

  const stopHost = useCallback(async (name: string) => {
    try {
      if (!confirm(`Remove container for host ${name}? It will remain in the topology and can be redeployed.`)) {
        return;
      }
      const response = await fetch(`${containerManagerUrl}/hosts/${name}/stop`, {
        method: 'POST'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to remove host container');
      }
      alert(`Host ${name} container removed successfully`);
      refetchConfig();
    } catch (error) {
      alert(`Failed to remove host container: ${error}`);
    }
  }, [containerManagerUrl, refetchConfig]);

  // Network actions
  const deployNetwork = useCallback(async (name: string) => {
    try {
      const result = await topologyService.deployNetwork(name, containerManagerUrl);
      if (!result.success) {
        throw new Error(result.error || 'Failed to deploy network');
      }
      alert(`Network ${name} deployed successfully`);
      refetchConfig();
    } catch (error) {
      alert(`Failed to deploy network: ${error}`);
    }
  }, [containerManagerUrl, refetchConfig]);

  // BGP Session actions - triggers reset-networking to apply BGP config
  const deployBGPSession = useCallback(async (session: any) => {
    try {
      // Get the daemons involved in this session
      const daemon1 = session.daemon1;
      const daemon2 = session.daemon2;

      if (!daemon1 || !daemon2) {
        throw new Error('Invalid BGP session data');
      }

      // Trigger reset-networking for both daemons to apply BGP configuration
      const results = await Promise.all([
        fetch(`${containerManagerUrl}/daemons/${daemon1}/reset-networking`, { method: 'POST' }),
        fetch(`${containerManagerUrl}/daemons/${daemon2}/reset-networking`, { method: 'POST' })
      ]);

      const errors = [];
      for (let i = 0; i < results.length; i++) {
        if (!results[i].ok) {
          const daemon = i === 0 ? daemon1 : daemon2;
          errors.push(`Failed to reset networking for ${daemon}`);
        }
      }

      if (errors.length > 0) {
        throw new Error(errors.join(', '));
      }

      alert(`BGP session between ${daemon1} and ${daemon2} deployed successfully.`);
      refetchConfig();
    } catch (error) {
      alert(`Failed to deploy BGP session: ${error}`);
    }
  }, [containerManagerUrl, refetchConfig]);

  return {
    // Daemon actions
    deployDaemon,
    stopDaemon,

    // Host actions
    deployHost,
    stopHost,

    // Network actions
    deployNetwork,

    // BGP Session actions
    deployBGPSession
  };
};
