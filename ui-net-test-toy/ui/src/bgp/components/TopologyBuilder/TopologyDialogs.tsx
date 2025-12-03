/**
 * Topology Dialogs
 * Consolidates all dialog components for the topology builder
 */

import React from 'react';
import BaseDialog from '../../../_common/components/ui/BaseDialog';
import { Button, ButtonGroup, InputField } from '../../../_common/components';
import SmartNeighborForm from '../SmartNeighborForm';
import { CreateDaemonDialog, CreateHostDialog } from '../EnvironmentManager';
import RouteAdvertisementForm from '../RouteAdvertisementForm';
import { TriggerForm } from '../FlowRules';
import GRETunnelForm from '../GRETunnelForm';
import buttonCss from '../../../_common/styles/Button.module.css';
import dialogCss from '../../../_common/styles/Dialog.module.css';
import { getCommonNetworks, getAllAvailableNetworks } from '../../utils/topologyUtils';
import type { TopologyNode, TopologyNetwork } from '../../types/topology';
import type { Trigger } from '../../../_common/types/netflow';

interface TopologyDialogsProps {
  // BGP Dialog
  showBGPForm: boolean;
  bgpFormData: { source: any; target: any } | null;
  onCloseBGPForm: () => void;
  onBGPSuccess: () => void;
  containerManagerUrl: string;

  // Network Selection Dialog
  showNetworkSelectionDialog: boolean;
  pendingLink: { source: string; target: string } | null;
  onCloseNetworkSelectionDialog: () => void;
  onNetworkSelected: (networkName: string) => void;
  onOpenNetworkDialog: () => void;
  findNode: (id: string) => TopologyNode | undefined;
  networks: TopologyNetwork[];
  nodes: TopologyNode[];
  topologyDetailsNetworks: any[] | undefined;
  onChangeMode: (mode: string) => void;

  // Network Dialog
  showNetworkDialog: boolean;
  networkForm: { name: string; subnet: string; gateway: string };
  onCloseNetworkDialog: () => void;
  onUpdateNetworkForm: (updates: Partial<{ name: string; subnet: string; gateway: string }>) => void;
  onResetNetworkForm: () => void;
  onSaveNetwork: () => void;

  // External Node Dialog
  showExternalNodeDialog: boolean;
  externalNodeForm: { name: string };
  onCloseExternalNodeDialog: () => void;
  onUpdateExternalNodeForm: (updates: Partial<{ name: string }>) => void;
  onSaveExternalNode: () => void;

  // External Network Dialog
  showExternalNetworkDialog: boolean;
  externalNetworkForm: { name: string; subnet: string; gateway: string };
  onCloseExternalNetworkDialog: () => void;
  onUpdateExternalNetworkForm: (updates: Partial<{ name: string; subnet: string; gateway: string }>) => void;
  onSaveExternalNetwork: () => void;

  // Load Dialog
  showLoadDialog: boolean;
  topologies: any[];
  activeTopology: any | null;
  onCloseLoadDialog: () => void;
  onLoadTopology: (name: string) => void;
  onActivateTopology: (name: string) => void;
  onDeleteTopology: (name: string) => void;

  // Create Topology Dialog
  showCreateTopologyDialog: boolean;
  newBackendTopologyName: string;
  newBackendTopologyDescription: string;
  newBackendTopologyMgmtNetwork: string;
  availableNetworks: Array<{ name: string; subnet: string }>;
  onCloseCreateTopologyDialog: () => void;
  onUpdateTopologyName: (name: string) => void;
  onUpdateTopologyDescription: (description: string) => void;
  onUpdateTopologyMgmtNetwork: (network: string) => void;
  onCreateTopology: () => void;

  // Edit Topology Dialog
  showEditTopology: boolean;
  editTopologyForm: { description: string; managementNetwork: string };
  selectedTopologyName: string | null;
  onCloseEditTopology: () => void;
  onUpdateEditTopologyForm: (field: string, value: string) => void;
  onSaveTopologyEdit: () => void;

  // Export Dialog
  showExportDialog: boolean;
  onCloseExportDialog: () => void;
  onExportJSON: () => void;
  onExportPNG: () => void;
  onExportSVG: () => void;

  // Create Daemon Dialog
  showCreateDaemon: boolean;
  newDaemon: any;
  editingDaemonName: string | null;
  onCloseCreateDaemon: () => void;
  onUpdateNewDaemon: (field: string, value: any) => void;
  onSaveDaemon: () => void;

  // Create Host Dialog
  showCreateHost: boolean;
  newHostForm: any;
  editingHostName: string | null;
  daemonsWithInterfaces: any[];
  onCloseCreateHost: () => void;
  onUpdateNewHostForm: (form: any) => void;
  onSaveHost: () => void;

  // Route Advertisement Dialog
  showRouteAdvertisementDialog: boolean;
  onCloseRouteAdvertisementDialog: () => void;

  // Trigger Dialog
  showTriggerDialog: boolean;
  triggerFormState: any;
  editingTriggerId?: string | number | null;
  onCloseTriggerDialog: () => void;
  onUpdateTriggerForm: (updates: Partial<Trigger>) => void;
  onSubmitTrigger: () => void;

  // GRE Tunnel Dialog
  showGRETunnelDialog: boolean;
  greTunnelFormData: {
    source: { name: string; type: 'daemon' | 'host' | 'external_node'; interfaces?: any[] };
    target: { name: string; type: 'daemon' | 'host' | 'external_node'; interfaces?: any[] };
  } | null;
  onCloseGRETunnelDialog: () => void;
  onGRETunnelSuccess: () => void;
  availableNodesForGRE?: Array<{
    name: string;
    type: 'daemon' | 'host' | 'external_node';
    networks: Array<{ name: string; ips: string[] }>;
    router_id?: string;
  }>;
}

export const TopologyDialogs: React.FC<TopologyDialogsProps> = ({
  // BGP Dialog
  showBGPForm,
  bgpFormData,
  onCloseBGPForm,
  onBGPSuccess,
  containerManagerUrl,

  // Network Selection Dialog
  showNetworkSelectionDialog,
  pendingLink,
  onCloseNetworkSelectionDialog,
  onNetworkSelected,
  onOpenNetworkDialog,
  findNode,
  networks,
  nodes,
  topologyDetailsNetworks,
  onChangeMode,

  // Network Dialog
  showNetworkDialog,
  networkForm,
  onCloseNetworkDialog,
  onUpdateNetworkForm,
  onResetNetworkForm,
  onSaveNetwork,

  // External Node Dialog
  showExternalNodeDialog,
  externalNodeForm,
  onCloseExternalNodeDialog,
  onUpdateExternalNodeForm,
  onSaveExternalNode,

  // External Network Dialog
  showExternalNetworkDialog,
  externalNetworkForm,
  onCloseExternalNetworkDialog,
  onUpdateExternalNetworkForm,
  onSaveExternalNetwork,

  // Load Dialog
  showLoadDialog,
  topologies,
  activeTopology,
  onCloseLoadDialog,
  onLoadTopology,
  onActivateTopology,
  onDeleteTopology,

  // Create Topology Dialog
  showCreateTopologyDialog,
  newBackendTopologyName,
  newBackendTopologyDescription,
  newBackendTopologyMgmtNetwork,
  availableNetworks,
  onCloseCreateTopologyDialog,
  onUpdateTopologyName,
  onUpdateTopologyDescription,
  onUpdateTopologyMgmtNetwork,
  onCreateTopology,

  // Edit Topology Dialog
  showEditTopology,
  editTopologyForm,
  selectedTopologyName,
  onCloseEditTopology,
  onUpdateEditTopologyForm,
  onSaveTopologyEdit,

  // Export Dialog
  showExportDialog,
  onCloseExportDialog,
  onExportJSON,
  onExportPNG,
  onExportSVG,

  // Create Daemon Dialog
  showCreateDaemon,
  newDaemon,
  editingDaemonName,
  onCloseCreateDaemon,
  onUpdateNewDaemon,
  onSaveDaemon,

  // Create Host Dialog
  showCreateHost,
  newHostForm,
  editingHostName,
  daemonsWithInterfaces,
  onCloseCreateHost,
  onUpdateNewHostForm,
  onSaveHost,

  // Route Advertisement Dialog
  showRouteAdvertisementDialog,
  onCloseRouteAdvertisementDialog,

  // Trigger Dialog
  showTriggerDialog,
  triggerFormState,
  editingTriggerId,
  onCloseTriggerDialog,
  onUpdateTriggerForm,
  onSubmitTrigger,

  // GRE Tunnel Dialog
  showGRETunnelDialog,
  greTunnelFormData,
  onCloseGRETunnelDialog,
  onGRETunnelSuccess,
  availableNodesForGRE = []
}) => {
  return (
    <>
      {/* BGP Configuration Dialog */}
      {showBGPForm && bgpFormData && (
        <BaseDialog open={showBGPForm} onClose={onCloseBGPForm}>
          <div style={{ padding: '1rem' }}>
            <SmartNeighborForm
              onSuccess={onBGPSuccess}
              onCancel={onCloseBGPForm}
              saveToTopologyOnly={true}
              topologyHostUrl={containerManagerUrl}
              initialSource={bgpFormData.source}
              initialTarget={bgpFormData.target}
            />
          </div>
        </BaseDialog>
      )}

      {/* Network Selection Dialog for Links */}
      {showNetworkSelectionDialog && pendingLink && (
        <BaseDialog
          open={showNetworkSelectionDialog}
          onClose={() => {
            onCloseNetworkSelectionDialog();
            onChangeMode('select');
          }}
        >
          <div style={{ padding: '2rem', minWidth: '400px' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Select Network for Link</h2>
            {(() => {
              const sourceNode = findNode(pendingLink.source);
              const targetNode = findNode(pendingLink.target);
              const commonNetworks = getCommonNetworks(sourceNode, targetNode);
              const allNetworks = getAllAvailableNetworks(networks, nodes, topologyDetailsNetworks);

              return (
                <>
                  <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    <div><strong>From:</strong> {sourceNode?.label || 'Unknown'}</div>
                    <div><strong>To:</strong> {targetNode?.label || 'Unknown'}</div>
                  </div>

                  {commonNetworks.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <div style={{
                        padding: '0.75rem',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        border: '1px solid rgba(76, 175, 80, 0.3)',
                        borderRadius: '4px',
                        marginBottom: '1rem'
                      }}>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text)' }}>
                          ✓ These nodes share {commonNetworks.length} network{commonNetworks.length > 1 ? 's' : ''}
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                          Common Networks:
                        </label>
                        {commonNetworks.map((network) => (
                          <button
                            key={network}
                            onClick={() => onNetworkSelected(network)}
                            style={{
                              padding: '0.75rem',
                              textAlign: 'left',
                              border: '2px solid rgba(76, 175, 80, 0.5)',
                              borderRadius: '4px',
                              backgroundColor: 'var(--background-primary)',
                              color: 'var(--text)',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              fontWeight: 500
                            }}
                          >
                            {network} <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>(Recommended)</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {allNetworks.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                        {commonNetworks.length > 0 ? 'Other Available Networks:' : 'Available Networks:'}
                      </label>
                      {allNetworks
                        .filter(net => !commonNetworks.includes(net))
                        .map((network) => (
                          <button
                            key={network}
                            onClick={() => onNetworkSelected(network)}
                            style={{
                              padding: '0.75rem',
                              textAlign: 'left',
                              border: '1px solid var(--border)',
                              borderRadius: '4px',
                              backgroundColor: 'var(--background-primary)',
                              color: 'var(--text)',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            {network}
                          </button>
                        ))}
                    </div>
                  )}

                  <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
                    <Button
                      onClick={() => {
                        onCloseNetworkSelectionDialog();
                        onOpenNetworkDialog();
                      }}
                      className={buttonCss.buttonPrimary}
                    >
                      + Create New Network
                    </Button>
                    <Button
                      onClick={() => {
                        onCloseNetworkSelectionDialog();
                        onChangeMode('select');
                      }}
                      className={buttonCss.buttonSecondary}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        </BaseDialog>
      )}

      {/* Network Dialog */}
      {showNetworkDialog && (
        <BaseDialog open={showNetworkDialog} onClose={onCloseNetworkDialog}>
          <div className={dialogCss.dialogContent}>
            <h2 className={dialogCss.dialogTitle}>Create Network</h2>
            <form onSubmit={(e) => { e.preventDefault(); onSaveNetwork(); }}>
              <InputField
                label="Network Name"
                value={networkForm.name}
                onChange={(e) => onUpdateNetworkForm({ name: e.target.value })}
                placeholder="e.g., my_network"
                required
              />
              <InputField
                label="Subnet (CIDR)"
                value={networkForm.subnet}
                onChange={(e) => onUpdateNetworkForm({ subnet: e.target.value })}
                placeholder="e.g., 10.10.10.0/24"
                required
              />
              <InputField
                label="Gateway IP"
                value={networkForm.gateway}
                onChange={(e) => onUpdateNetworkForm({ gateway: e.target.value })}
                placeholder="e.g., 10.10.10.1"
                required
              />
              <ButtonGroup>
                <Button type="submit" className={buttonCss.buttonPrimary}>
                  Create Network
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    onResetNetworkForm();
                    onCloseNetworkDialog();
                  }}
                  className={buttonCss.buttonSecondary}
                >
                  Cancel
                </Button>
              </ButtonGroup>
            </form>
          </div>
        </BaseDialog>
      )}

      {/* External Node Dialog */}
      {showExternalNodeDialog && (
        <BaseDialog open={showExternalNodeDialog} onClose={onCloseExternalNodeDialog}>
          <div className={dialogCss.dialogContent}>
            <h2 className={dialogCss.dialogTitle}>Create External Node</h2>
            <form onSubmit={(e) => { e.preventDefault(); onSaveExternalNode(); }}>
              <InputField
                label="Node Name"
                value={externalNodeForm.name}
                onChange={(e) => onUpdateExternalNodeForm({ name: e.target.value })}
                placeholder="e.g., external_peer"
                required
              />
              <ButtonGroup>
                <Button type="submit" className={buttonCss.buttonPrimary}>
                  Create Node
                </Button>
                <Button
                  type="button"
                  onClick={onCloseExternalNodeDialog}
                  className={buttonCss.buttonSecondary}
                >
                  Cancel
                </Button>
              </ButtonGroup>
            </form>
          </div>
        </BaseDialog>
      )}

      {/* External Network Dialog */}
      {showExternalNetworkDialog && (
        <BaseDialog open={showExternalNetworkDialog} onClose={onCloseExternalNetworkDialog}>
          <div className={dialogCss.dialogContent}>
            <h2 className={dialogCss.dialogTitle}>Create External Network</h2>
            <form onSubmit={(e) => { e.preventDefault(); onSaveExternalNetwork(); }}>
              <InputField
                label="Network Name"
                value={externalNetworkForm.name}
                onChange={(e) => onUpdateExternalNetworkForm({ name: e.target.value })}
                placeholder="e.g., internet"
                required
              />
              <InputField
                label="Subnet (CIDR)"
                value={externalNetworkForm.subnet}
                onChange={(e) => onUpdateExternalNetworkForm({ subnet: e.target.value })}
                placeholder="e.g., 203.0.113.0/24"
                required
              />
              <InputField
                label="Gateway IP"
                value={externalNetworkForm.gateway}
                onChange={(e) => onUpdateExternalNetworkForm({ gateway: e.target.value })}
                placeholder="e.g., 203.0.113.1"
                required
              />
              <ButtonGroup>
                <Button type="submit" className={buttonCss.buttonPrimary}>
                  Create External Network
                </Button>
                <Button
                  type="button"
                  onClick={onCloseExternalNetworkDialog}
                  className={buttonCss.buttonSecondary}
                >
                  Cancel
                </Button>
              </ButtonGroup>
            </form>
          </div>
        </BaseDialog>
      )}

      {/* Load Topology Dialog */}
      {showLoadDialog && (
        <BaseDialog open={showLoadDialog} onClose={onCloseLoadDialog}>
          <div className={dialogCss.dialogContent}>
            <h2 className={dialogCss.dialogTitle}>Load Topology</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {topologies.map((topo) => (
                <div
                  key={topo.name}
                  style={{
                    padding: '1rem',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    backgroundColor: topo.active ? 'rgba(76, 175, 80, 0.1)' : 'var(--background-primary)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {topo.name} {topo.active && '(Active)'}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {topo.description || 'No description'}
                      </div>
                    </div>
                    <ButtonGroup>
                      <Button
                        onClick={() => onLoadTopology(topo.name)}
                        className={buttonCss.buttonPrimary}
                      >
                        Load
                      </Button>
                      {!topo.active && (
                        <Button
                          onClick={() => onActivateTopology(topo.name)}
                          className={buttonCss.buttonSecondary}
                        >
                          Activate
                        </Button>
                      )}
                      <Button
                        onClick={() => {
                          if (confirm(`Delete topology ${topo.name}?`)) {
                            onDeleteTopology(topo.name);
                          }
                        }}
                        className={buttonCss.buttonDelete}
                      >
                        Delete
                      </Button>
                    </ButtonGroup>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '1rem' }}>
              <Button onClick={onCloseLoadDialog} className={buttonCss.buttonSecondary}>
                Close
              </Button>
            </div>
          </div>
        </BaseDialog>
      )}

      {/* Create Daemon Dialog */}
      {showCreateDaemon && (
        <CreateDaemonDialog
          open={showCreateDaemon}
          onClose={onCloseCreateDaemon}
          daemonData={newDaemon}
          onChange={onUpdateNewDaemon}
          onSave={onSaveDaemon}
          isEditing={!!editingDaemonName}
        />
      )}

      {/* Create Host Dialog */}
      {showCreateHost && (
        <CreateHostDialog
          open={showCreateHost}
          onClose={onCloseCreateHost}
          newHostForm={newHostForm}
          editingHostContainerId={editingHostName}
          onChange={onUpdateNewHostForm}
          onSave={onSaveHost}
          selectedHostId=""
          localDaemons={{ '': daemonsWithInterfaces || [] }}
        />
      )}

      {/* Route Advertisement Dialog */}
      {showRouteAdvertisementDialog && (
        <BaseDialog open={showRouteAdvertisementDialog} onClose={onCloseRouteAdvertisementDialog}>
          <div style={{ padding: '1rem' }}>
            <RouteAdvertisementForm onSuccess={onCloseRouteAdvertisementDialog} />
          </div>
        </BaseDialog>
      )}

      {/* Trigger Dialog */}
      {showTriggerDialog && (
        <BaseDialog open={showTriggerDialog} onClose={onCloseTriggerDialog}>
          <div style={{ padding: '1rem' }}>
            <TriggerForm
              initialData={triggerFormState}
              onChange={onUpdateTriggerForm}
              onSubmit={onSubmitTrigger}
              onCancel={onCloseTriggerDialog}
              isEditing={!!editingTriggerId}
            />
          </div>
        </BaseDialog>
      )}

      {/* GRE Tunnel Dialog */}
      {showGRETunnelDialog && (
        <BaseDialog open={showGRETunnelDialog} onClose={onCloseGRETunnelDialog}>
          <div style={{ padding: '1rem' }}>
            <GRETunnelForm
              onSuccess={onGRETunnelSuccess}
              onCancel={onCloseGRETunnelDialog}
              saveToTopologyOnly={true}
              topologyHostUrl={containerManagerUrl}
              topologyName={selectedTopologyName || 'default'}
              initialSource={greTunnelFormData?.source}
              initialTarget={greTunnelFormData?.target}
              availableNodes={availableNodesForGRE}
            />
          </div>
        </BaseDialog>
      )}
    </>
  );
};
