/**
 * Topology Forms Hook
 * Manages form state for creating/editing daemons, hosts, triggers, and topology settings
 */

import { useCallback, useState } from 'react';
import type { Trigger } from '../../_common/types/netflow';

interface DaemonForm {
  daemon_type: string;
  name: string;
  asn: string;
  router_id: string;
  ip_address: string;
  network: string;
  color: string;
}

interface HostForm {
  name: string;
  gateway_daemon: string;
  gateway_ip: string;
  container_ip: string;
  loopback_ip: string;
  loopback_network: string;
  network: string;
  color: string;
}

interface TopologyEditForm {
  description: string;
  managementNetwork: string;
}

const DEFAULT_DAEMON_FORM: DaemonForm = {
  daemon_type: 'gobgp',
  name: '',
  asn: '',
  router_id: '',
  ip_address: '',
  network: 'netstream_lab_builder_network',
  color: '#4CAF50'
};

const DEFAULT_HOST_FORM: HostForm = {
  name: '',
  gateway_daemon: '',
  gateway_ip: '',
  container_ip: '',
  loopback_ip: '',
  loopback_network: '24',
  network: 'netstream_lab_builder_network',
  color: '#D7CCC8'
};

export interface UseTopologyFormsOptions {
  topologies: any[];
  selectedTopologyName: string | null;
}

export const useTopologyForms = (options: UseTopologyFormsOptions) => {
  const { topologies, selectedTopologyName } = options;

  // Dialog visibility state
  const [showCreateDaemon, setShowCreateDaemon] = useState(false);
  const [showCreateHost, setShowCreateHost] = useState(false);
  const [showEditTopology, setShowEditTopology] = useState(false);
  const [showTriggerDialog, setShowTriggerDialog] = useState(false);
  const [showRouteAdvertisementDialog, setShowRouteAdvertisementDialog] = useState(false);

  // Editing state
  const [editingDaemonName, setEditingDaemonName] = useState<string | null>(null);
  const [editingHostName, setEditingHostName] = useState<string | null>(null);
  const [editingTriggerId, setEditingTriggerId] = useState<string | number | null>(null);

  // Form state
  const [newDaemon, setNewDaemon] = useState<DaemonForm>(DEFAULT_DAEMON_FORM);
  const [newHostForm, setNewHostForm] = useState<HostForm>(DEFAULT_HOST_FORM);
  const [editTopologyForm, setEditTopologyForm] = useState<TopologyEditForm>({
    description: '',
    managementNetwork: ''
  });
  const [triggerFormState, setTriggerFormState] = useState<Partial<Trigger>>({
    name: '',
    enabled: true,
    action: { type: 'log' }
  });

  // Get management network from current topology
  const getManagementNetwork = useCallback(() => {
    const currentTopology = topologies.find(t => t.name === selectedTopologyName);
    return (currentTopology as any)?.management_network || 'netstream_lab_builder_network';
  }, [topologies, selectedTopologyName]);

  // Daemon dialog handlers
  const openCreateDaemonDialog = useCallback(() => {
    setEditingDaemonName(null);
    setNewDaemon({
      ...DEFAULT_DAEMON_FORM,
      network: getManagementNetwork()
    });
    setShowCreateDaemon(true);
  }, [getManagementNetwork]);

  const closeCreateDaemonDialog = useCallback(() => {
    setShowCreateDaemon(false);
    setEditingDaemonName(null);
  }, []);

  const openEditDaemonDialog = useCallback((daemon: any) => {
    setEditingDaemonName(daemon.name);
    setNewDaemon({
      daemon_type: daemon.daemon_type || 'gobgp',
      name: daemon.name || '',
      asn: daemon.asn?.toString() || '',
      router_id: daemon.router_id || '',
      ip_address: daemon.ip_address || '',
      network: daemon.network || 'netstream_lab_builder_network',
      color: daemon.color || '#4CAF50'
    });
    setShowCreateDaemon(true);
  }, []);

  const updateDaemonForm = useCallback((field: string, value: any) => {
    setNewDaemon(prev => ({ ...prev, [field]: value }));
  }, []);

  // Host dialog handlers
  const openCreateHostDialog = useCallback(() => {
    setEditingHostName(null);
    setNewHostForm({
      ...DEFAULT_HOST_FORM,
      network: getManagementNetwork()
    });
    setShowCreateHost(true);
  }, [getManagementNetwork]);

  const closeCreateHostDialog = useCallback(() => {
    setShowCreateHost(false);
    setEditingHostName(null);
  }, []);

  const openEditHostDialog = useCallback((host: any) => {
    setEditingHostName(host.name);
    setNewHostForm({
      name: host.name || '',
      gateway_daemon: host.gateway_daemon || '',
      gateway_ip: host.gateway_ip || '',
      container_ip: host.container_ip || '',
      loopback_ip: host.loopback_ip || '',
      loopback_network: host.loopback_network || '24',
      network: 'netstream_lab_builder_network',
      color: host.color || '#D7CCC8'
    });
    setShowCreateHost(true);
  }, []);

  const updateHostForm = useCallback((form: any) => {
    setNewHostForm(form);
  }, []);

  // Topology edit handlers
  const openEditTopologyDialog = useCallback(() => {
    const currentTopology = topologies.find(t => t.name === selectedTopologyName);
    setEditTopologyForm({
      description: (currentTopology as any)?.description || '',
      managementNetwork: (currentTopology as any)?.management_network || ''
    });
    setShowEditTopology(true);
  }, [topologies, selectedTopologyName]);

  const closeEditTopologyDialog = useCallback(() => {
    setShowEditTopology(false);
  }, []);

  const updateEditTopologyForm = useCallback((field: string, value: any) => {
    setEditTopologyForm(prev => ({ ...prev, [field]: value }));
  }, []);

  // Trigger dialog handlers
  const openTriggerDialog = useCallback(() => {
    setEditingTriggerId(null);
    setTriggerFormState({
      name: '',
      enabled: true,
      action: { type: 'log' }
    });
    setShowTriggerDialog(true);
  }, []);

  const openEditTriggerDialog = useCallback((trigger: any) => {
    // Convert flat trigger format from API to nested Trigger format
    setEditingTriggerId(trigger.id);
    setTriggerFormState({
      id: trigger.id?.toString(),
      name: trigger.name || '',
      enabled: trigger.enabled === true || trigger.enabled === 1,
      conditions: {
        min_kbps: trigger.min_kbps ? parseFloat(trigger.min_kbps) : undefined,
        min_mbps: trigger.min_mbps ? parseFloat(trigger.min_mbps) : undefined,
        min_pps: trigger.min_pps ? parseFloat(trigger.min_pps) : undefined,
        src_addr: trigger.src_addr || undefined,
        dst_addr: trigger.dst_addr || undefined,
        src_or_dst_addr: trigger.src_or_dst_addr || undefined,
        protocol: trigger.protocol ? parseInt(trigger.protocol) : undefined
      },
      action: {
        type: (trigger.action_type as 'log' | 'alert' | 'flowspec') || 'log',
        message: trigger.action_message || undefined,
        rate_limit_kbps: trigger.rate_limit_kbps ? parseFloat(trigger.rate_limit_kbps) : undefined
      }
    });
    setShowTriggerDialog(true);
  }, []);

  const closeTriggerDialog = useCallback(() => {
    setShowTriggerDialog(false);
    setEditingTriggerId(null);
  }, []);

  const updateTriggerForm = useCallback((updates: Partial<Trigger>) => {
    setTriggerFormState(prev => ({ ...prev, ...updates }));
  }, []);

  // Route advertisement dialog handlers
  const openRouteAdvertisementDialog = useCallback(() => {
    setShowRouteAdvertisementDialog(true);
  }, []);

  const closeRouteAdvertisementDialog = useCallback(() => {
    setShowRouteAdvertisementDialog(false);
  }, []);

  return {
    // Daemon form
    showCreateDaemon,
    newDaemon,
    editingDaemonName,
    openCreateDaemonDialog,
    closeCreateDaemonDialog,
    openEditDaemonDialog,
    updateDaemonForm,

    // Host form
    showCreateHost,
    newHostForm,
    editingHostName,
    openCreateHostDialog,
    closeCreateHostDialog,
    openEditHostDialog,
    updateHostForm,

    // Topology edit form
    showEditTopology,
    editTopologyForm,
    openEditTopologyDialog,
    closeEditTopologyDialog,
    updateEditTopologyForm,

    // Trigger form
    showTriggerDialog,
    triggerFormState,
    editingTriggerId,
    openTriggerDialog,
    openEditTriggerDialog,
    closeTriggerDialog,
    updateTriggerForm,

    // Route advertisement
    showRouteAdvertisementDialog,
    openRouteAdvertisementDialog,
    closeRouteAdvertisementDialog
  };
};
