/**
 * Topology Builder Page (Refactored)
 * Visual network topology designer with BGP configuration
 *
 * This is a refactored version using extracted hooks and components
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { PageLayout, NavBarPageHeader } from '../../_common/components';
import { useContainerManager, useConfig } from '../../_common/contexts/ConfigContext';
import { topologyService } from '../../_common/services/topology/topologyService';
import { netflowService } from '../../_common/services/netflow/netflowService';
import { useNetworkTesting } from '../../_common/hooks/useNetworkTesting';
import { useNetFlowStream } from '../../_common/hooks/useNetFlow';

// Import extracted hooks
import {
  useTopologyCanvas,
  useTopologyDialogs,
  useTopologyBuilderOperations,
  useTopologyData,
  useTopologyConnectionHandlers,
  useTopologyExport,
  useTopologyForms,
  useTopologyNeighbors,
  useTopologyPanelActions,
  useTopologyGRENodes,
  useTopologyDialogHandlers
} from '../hooks';

// Import extracted components
import {
  TopologyHeader,
  TopologyMapItemsPanel,
  TopologyDialogs,
  TopologyFixedControls,
  TapDialog
} from '../components/TopologyBuilder';
import { TopologyCanvas, CanvasBottomControls, TopTalkersOverlay } from '../components/Topology';
import { TestOutputPane } from '../components/NetworkTesting/TestOutputPane';

// Import utilities
import { getAllIPs } from '../../_common/utils/networkUtils';
import { tapService } from '../services/tapService';

const TopologyBuilder: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);

  // Get Container Manager URL
  const containerManager = useContainerManager();
  const containerManagerUrl = containerManager?.url || '';
  const { config: appConfig } = useConfig();

  // Topology selection state
  const [selectedTopologyName, setSelectedTopologyName] = useState<string | null>(null);

  // NetFlow WebSocket streaming - enables Top Talkers overlay
  useNetFlowStream(true, undefined, containerManagerUrl);

  // Canvas hooks
  const canvasHook = useTopologyCanvas();
  const dialogsHook = useTopologyDialogs({ hostUrl: containerManagerUrl });

  // Business logic operations
  const operations = useTopologyBuilderOperations({
    containerManagerUrl,
    selectedTopologyName,
    canvasNodes: canvasHook.nodes,
    canvasLinks: canvasHook.links,
    onNodesChange: canvasHook.setNodes,
    onLinksChange: canvasHook.setLinks
  });

  // Data transformation - pass current nodes/links to preserve local state during updates
  useTopologyData(
    operations.topologyDetails,
    operations.daemonsWithInterfaces,
    canvasHook.setNodes,
    canvasHook.setLinks,
    canvasHook.nodes,
    canvasHook.links
  );

  // Connection handlers (links, BGP, GRE, taps, quick tests)
  const connectionHandlers = useTopologyConnectionHandlers({
    containerManagerUrl,
    selectedTopologyName,
    interactionMode: canvasHook.interactionMode,
    firstSelectedForLink: canvasHook.firstSelectedForLink,
    setFirstSelectedForLink: canvasHook.setFirstSelectedForLink,
    changeMode: canvasHook.changeMode,
    findNode: canvasHook.findNode,
    addLink: canvasHook.addLink,
    nodes: canvasHook.nodes,
    openNetworkSelectionDialog: dialogsHook.openNetworkSelectionDialog,
    closeNetworkSelectionDialog: dialogsHook.closeNetworkSelectionDialog,
    openBGPForm: dialogsHook.openBGPForm,
    closeBGPForm: dialogsHook.closeBGPForm,
    bgpFormData: dialogsHook.bgpFormData,
    openGRETunnelForm: dialogsHook.openGRETunnelForm,
    pendingLink: dialogsHook.pendingLink,
    topologyDetails: operations.topologyDetails,
    daemonsWithInterfaces: operations.daemonsWithInterfaces,
    loadTopologyDetails: operations.loadTopologyDetails
  });

  // Export handlers
  const exportHook = useTopologyExport({
    canvasRef,
    nodes: canvasHook.nodes,
    links: canvasHook.links,
    networks: canvasHook.networks,
    topologyName: selectedTopologyName
  });

  // Forms hook for all dialog form state
  const formsHook = useTopologyForms({
    topologies: operations.topologies,
    selectedTopologyName
  });

  // Panel actions hook for deploy/stop/edit operations
  const panelActions = useTopologyPanelActions({
    containerManagerUrl,
    appConfig,
    refetchConfig: operations.refetchConfig
  });

  // GRE available nodes computation
  const availableNodesForGRE = useTopologyGRENodes({
    daemonsWithInterfaces: operations.daemonsWithInterfaces,
    topologyDetails: operations.topologyDetails
  });

  // Dialog handlers (consolidated async submit handlers)
  const dialogHandlers = useTopologyDialogHandlers({
    containerManagerUrl,
    selectedTopologyName,
    loadTopologyDetails: operations.loadTopologyDetails,
    loadTopologies: operations.loadTopologies,
    handleAddNetwork: operations.handleAddNetwork,
    handleSaveDaemon: operations.handleSaveDaemon,
    handleSaveHost: operations.handleSaveHost,
    handleSubmitTrigger: operations.handleSubmitTrigger,
    refetchConfig: operations.refetchConfig,
    closeNetworkDialog: dialogsHook.closeNetworkDialog,
    resetNetworkForm: dialogsHook.resetNetworkForm,
    closeExternalNodeDialog: dialogsHook.closeExternalNodeDialog,
    closeExternalNetworkDialog: dialogsHook.closeExternalNetworkDialog,
    closeCreateTopologyDialog: dialogsHook.closeCreateTopologyDialog,
    closeEditTopologyDialog: formsHook.closeEditTopologyDialog,
    closeCreateDaemonDialog: formsHook.closeCreateDaemonDialog,
    closeCreateHostDialog: formsHook.closeCreateHostDialog,
    closeTriggerDialog: formsHook.closeTriggerDialog,
    closeGRETunnelDialog: dialogsHook.closeGRETunnelDialog,
    networkForm: dialogsHook.networkForm,
    externalNodeForm: dialogsHook.externalNodeForm,
    externalNetworkForm: dialogsHook.externalNetworkForm,
    newBackendTopologyName: dialogsHook.newBackendTopologyName,
    newBackendTopologyDescription: dialogsHook.newBackendTopologyDescription,
    newBackendTopologyMgmtNetwork: dialogsHook.newBackendTopologyMgmtNetwork,
    editTopologyForm: formsHook.editTopologyForm,
    newDaemon: formsHook.newDaemon,
    editingDaemonName: formsHook.editingDaemonName,
    newHostForm: formsHook.newHostForm,
    editingHostName: formsHook.editingHostName,
    triggerFormState: formsHook.triggerFormState,
    editingTriggerId: formsHook.editingTriggerId,
    createTopology: operations.createTopology
  });

  // UI state
  const [componentsExpanded, setComponentsExpanded] = useState(true);
  const [showTopTalkers, setShowTopTalkers] = useState(false);

  // Arc drag handlers for BGP links
  const handleArcDragStart = useCallback((linkId: string) => {
    // Optional: Could add visual feedback here
    console.log('Arc drag started for link:', linkId);
  }, []);

  const handleArcDrag = useCallback((linkId: string, newArc: number) => {
    // Update local state for live preview
    canvasHook.updateLinkArc(linkId, newArc);
  }, [canvasHook]);

  const handleArcDragEnd = useCallback(async (linkId: string, finalArc: number) => {
    if (!selectedTopologyName) return;

    // Find the link to get the session/link ID
    const link = canvasHook.findLink(linkId);
    if (!link) {
      console.warn('Cannot persist arc: link not found', linkId);
      return;
    }

    try {
      let result;
      if (link.type === 'bgp' && link.data?.sessionId) {
        result = await topologyService.updateBGPSessionArc(
          selectedTopologyName,
          link.data.sessionId,
          finalArc,
          containerManagerUrl
        );
      } else if (link.type === 'gre' && link.data?.linkId) {
        result = await topologyService.updateGRELinkArc(
          selectedTopologyName,
          link.data.linkId,
          finalArc,
          containerManagerUrl
        );
      } else {
        console.warn('Cannot persist arc: link type not supported or missing ID', link.type);
        return;
      }

      if (!result.success) {
        console.error('Failed to persist arc:', result.error);
        // Optionally revert local state here
      }
    } catch (error) {
      console.error('Failed to persist arc:', error);
    }
  }, [selectedTopologyName, containerManagerUrl, canvasHook]);

  // Configure netflowService
  useEffect(() => {
    if (containerManagerUrl) {
      netflowService.setContainerManagerUrl(containerManagerUrl);
    }
  }, [containerManagerUrl]);

  // Load neighbors for BGP session status (extracted to hook)
  useTopologyNeighbors({
    containerManagerUrl,
    daemons: appConfig?.daemons
  });

  // Network testing hook for quick tests
  const { runTest, currentTest, selectSourceHost, selectTargetHost, selectSourceIP, selectTargetIP, stopCurrentTest, labHosts } = useNetworkTesting();

  // Auto-load active topology
  useEffect(() => {
    if (operations.activeTopology && !selectedTopologyName) {
      setSelectedTopologyName(operations.activeTopology.name);
      operations.loadTopologyDetails(operations.activeTopology.name);
    }
  }, [operations.activeTopology, selectedTopologyName]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (canvasHook.interactionMode === 'add-link' ||
            canvasHook.interactionMode === 'add-bgp-neighbor' ||
            canvasHook.interactionMode === 'quick-test') {
          canvasHook.setFirstSelectedForLink(null);
          canvasHook.changeMode('select');
          dialogsHook.closeNetworkSelectionDialog();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvasHook.interactionMode]);

  // Deploy topology handler
  const handleDeployTopology = useCallback(async () => {
    if (!selectedTopologyName) return;

    const confirmed = window.confirm(
      `Deploy topology "${selectedTopologyName}"?\n\nThis will create all networks, containers, and configure BGP peers.`
    );

    if (!confirmed) return;

    try {
      const result = await topologyService.activateTopology(
        selectedTopologyName,
        containerManagerUrl
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to deploy topology');
      }

      alert('Topology deployed successfully!');
      await operations.loadTopologies();
      await operations.loadTopologyDetails(selectedTopologyName);
    } catch (error) {
      console.error('Failed to deploy topology:', error);
      alert(`Failed to deploy topology: ${error}`);
    }
  }, [selectedTopologyName, operations, containerManagerUrl]);

  // Stop topology handler
  const handleStopTopology = useCallback(async () => {
    if (!selectedTopologyName) return;

    const confirmed = window.confirm(
      `Stop topology "${selectedTopologyName}"?\n\nThis will stop all containers but keep them in the topology. Use Deploy to restart.`
    );

    if (!confirmed) return;

    try {
      const result = await topologyService.stopTopology(
        selectedTopologyName,
        containerManagerUrl
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to stop topology');
      }

      alert('Topology stopped successfully!');
      await operations.loadTopologies();
      await operations.loadTopologyDetails(selectedTopologyName);
    } catch (error) {
      console.error('Failed to stop topology:', error);
      alert(`Failed to stop topology: ${error}`);
    }
  }, [selectedTopologyName, operations, containerManagerUrl]);

  // Tap deploy handler
  const handleDeployTap = useCallback(async (tap: any) => {
    const containerName = tap.container_name || tap.target_container;
    const interfaceName = tap.interface_name || tap.target_interface;

    try {
      const result = await tapService.startTap(containerManagerUrl, containerName, interfaceName);
      if (!result.success) {
        throw new Error(result.error || 'Failed to start tap');
      }
      // Refresh topology details to update tap status
      if (selectedTopologyName) {
        await operations.loadTopologyDetails(selectedTopologyName);
      }
    } catch (error) {
      console.error('Failed to start tap:', error);
      alert(`Failed to start tap: ${error}`);
    }
  }, [containerManagerUrl, selectedTopologyName, operations]);

  // Tap stop handler
  const handleStopTap = useCallback(async (tap: any) => {
    const containerName = tap.container_name || tap.target_container;
    const interfaceName = tap.interface_name || tap.target_interface;

    try {
      const result = await tapService.stopTap(containerManagerUrl, containerName, interfaceName);
      if (!result.success) {
        throw new Error(result.error || 'Failed to stop tap');
      }
      // Refresh topology details to update tap status
      if (selectedTopologyName) {
        await operations.loadTopologyDetails(selectedTopologyName);
      }
    } catch (error) {
      console.error('Failed to stop tap:', error);
      alert(`Failed to stop tap: ${error}`);
    }
  }, [containerManagerUrl, selectedTopologyName, operations]);

  // BGP session delete handler - deletes a session by ID
  const handleDeleteBGPSession = useCallback(async (session: any) => {
    if (!selectedTopologyName || !session?.id) return;

    const confirmMsg = `Delete BGP session between ${session.daemon1} and ${session.daemon2}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const result = await topologyService.deleteBGPSession(
        selectedTopologyName,
        session.id,
        containerManagerUrl
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete BGP session');
      }

      // Refresh topology details
      await operations.loadTopologyDetails(selectedTopologyName);
    } catch (error) {
      console.error('Failed to delete BGP session:', error);
      alert(`Failed to delete BGP session: ${error}`);
    }
  }, [containerManagerUrl, selectedTopologyName, operations]);

  // GRE link delete handler
  const handleDeleteGRETunnel = useCallback(async (linkData: any) => {
    if (!selectedTopologyName) return;

    // Handle both old format (from canvas link.data) and new format (GRELink)
    const link = linkData.link || linkData;
    const linkId = linkData.linkId || link?.id;

    if (!linkId) {
      console.warn('No link ID found for GRE tunnel deletion');
      return;
    }

    const confirmMsg = link?.container1 && link?.container2
      ? `Delete GRE link between ${link.container1} and ${link.container2}?`
      : 'Delete GRE link?';

    if (!window.confirm(confirmMsg)) return;

    try {
      const result = await topologyService.deleteGRELink(
        selectedTopologyName,
        linkId,
        containerManagerUrl
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete GRE link');
      }

      // Refresh topology details
      await operations.loadTopologyDetails(selectedTopologyName);
    } catch (error) {
      console.error('Failed to delete GRE link:', error);
      alert(`Failed to delete GRE link: ${error}`);
    }
  }, [containerManagerUrl, selectedTopologyName, operations]);

  // Trigger delete handler
  const handleDeleteTrigger = useCallback(async (trigger: any) => {
    if (!selectedTopologyName || !trigger.id) return;

    if (!window.confirm(`Delete trigger "${trigger.name}"?`)) return;

    try {
      const response = await fetch(
        `${containerManagerUrl}/topologies/${selectedTopologyName}/triggers/${trigger.id}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        throw new Error('Failed to delete trigger');
      }
      // Refresh topology details
      await operations.loadTopologyDetails(selectedTopologyName);
    } catch (error) {
      console.error('Failed to delete trigger:', error);
      alert(`Failed to delete trigger: ${error}`);
    }
  }, [containerManagerUrl, selectedTopologyName, operations]);

  return (
    <PageLayout useDashboardGrid={false}>
      <NavBarPageHeader
        title="Topology Builder"
        subtitle={selectedTopologyName
          ? `Visual network topology designer • Topology: ${selectedTopologyName}`
          : "Visual network topology designer"}
      />

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 200px)',
        minHeight: '750px',
        minWidth: 0
      }}>
        <TopologyHeader
          topologyError={operations.error}
          successMessage={operations.successMessage}
          labFeedback={operations.labFeedback}
          selectedLink={canvasHook.selectedLink}
          findLink={canvasHook.findLink}
          findNode={canvasHook.findNode}
          onClearErrors={operations.clearErrors}
          onClearSuccess={operations.clearSuccess}
          onClearLabFeedback={operations.clearLabFeedback}
          onDeleteLink={operations.handleDeleteLink}
          onClearSelectedLink={() => canvasHook.setSelectedLink(null)}
        />

        {/* Main content area */}
        <div style={{
          position: 'relative',
          flex: 1,
          minHeight: '600px',
          width: '100%',
          overflow: 'hidden'
        }}>
          {/* Canvas */}
          <TopologyCanvas
            ref={canvasRef}
            nodes={canvasHook.nodes}
            links={canvasHook.links}
            selectedNode={canvasHook.selectedNode}
            hoveredNode={canvasHook.hoveredNode}
            selectedLink={canvasHook.selectedLink}
            hoveredLink={canvasHook.hoveredLink}
            interactionMode={canvasHook.interactionMode}
            firstSelectedForLink={canvasHook.firstSelectedForLink}
            taps={(operations.topologyDetails as any)?.taps}
            // Node operations for internal drag and drop
            addNode={canvasHook.addNode}
            updateNodePosition={canvasHook.updateNodePosition}
            findNode={canvasHook.findNode}
            onNodeClickForConnection={connectionHandlers.handleNodeClickForConnection}
            onNodeDragEnd={operations.handleNodeDragEnd}
            // Node handlers
            onNodeMouseEnter={canvasHook.setHoveredNode}
            onNodeMouseLeave={() => canvasHook.setHoveredNode(null)}
            onNodeDoubleClick={canvasHook.setSelectedNode}
            onNodeDelete={operations.handleDeleteNode}
            // Link handlers
            onLinkMouseEnter={canvasHook.setHoveredLink}
            onLinkMouseLeave={() => canvasHook.setHoveredLink(null)}
            onLinkClick={canvasHook.setSelectedLink}
            onLinkDelete={(linkId) => {
              operations.handleDeleteLink(linkId);
              canvasHook.setHoveredLink(null);
            }}
            // Arc drag handlers for BGP links
            onArcDragStart={handleArcDragStart}
            onArcDrag={handleArcDrag}
            onArcDragEnd={handleArcDragEnd}
          >
            {/* Quick Test Output (mini mode) - rendered inside canvas */}
            {connectionHandlers.quickTestNodes && (
              <TestOutputPane
                output={currentTest?.output || []}
                isRunning={currentTest?.isRunning}
                currentTestId={currentTest?.id}
                mini={true}
                onClose={() => {
                  stopCurrentTest();
                  connectionHandlers.closeQuickTest();
                }}
                onStop={() => {
                  stopCurrentTest();
                }}
                labHosts={labHosts}
                onStartTest={(srcIp, dstIp, testType) => {
                  // Find which host owns each IP
                  const findHostForIP = (ip: string) => {
                    return labHosts?.find(host => {
                      const hostIPs = getAllIPs(host).map(({ ip }) => ip);
                      return hostIPs.includes(ip);
                    });
                  };

                  const sourceHost = findHostForIP(srcIp);
                  const targetHost = findHostForIP(dstIp);

                  if (!sourceHost || !targetHost) {
                    console.error('Could not find host for IP addresses', { srcIp, dstIp, sourceHost, targetHost });
                    return;
                  }

                  // Update the network testing state (for display purposes)
                  selectSourceHost(sourceHost.name);
                  selectTargetHost(targetHost.name);
                  selectSourceIP(srcIp);
                  selectTargetIP(dstIp);

                  // Build params based on test type
                  const buildTestParams = (): { source_ip?: string; host: string; [key: string]: any } => {
                    const baseParams = {
                      source_ip: srcIp,
                      host: dstIp,
                    };

                    switch (testType) {
                      case 'ping':
                        return { ...baseParams, count: 5 };
                      case 'traceroute':
                        return { ...baseParams, maxHops: 30 };
                      case 'iperf':
                        return { ...baseParams, server: dstIp, duration: 10 };
                      case 'curl':
                        return { ...baseParams, host: `http://${dstIp}`, count: 5, sleep: 0.5 };
                      case 'hping':
                        return { ...baseParams, count: 5, protocol: 'icmp' };
                      default:
                        return baseParams;
                    }
                  };

                  // Run the test with explicit host names (bypasses stale store state)
                  runTest({
                    tool: testType,
                    params: buildTestParams()
                  }, {
                    sourceHost: sourceHost.name,
                    targetHost: targetHost.name
                  });
                }}
              />
            )}

            {/* Top Talkers Overlay */}
            <TopTalkersOverlay
              isOpen={showTopTalkers}
              onClose={() => setShowTopTalkers(false)}
            />

            {/* Canvas Bottom Controls */}
            <CanvasBottomControls
              showQuickTest={!!connectionHandlers.quickTestNodes}
              showTopTalkers={showTopTalkers}
              onToggleQuickTest={() => {
                if (connectionHandlers.quickTestNodes) {
                  stopCurrentTest();
                  connectionHandlers.closeQuickTest();
                } else {
                  connectionHandlers.openQuickTestDirect();
                }
              }}
              onToggleTopTalkers={() => setShowTopTalkers(!showTopTalkers)}
            />
          </TopologyCanvas>

          {/* Map Items Panel */}
          <TopologyMapItemsPanel
            nodes={canvasHook.nodes}
            links={canvasHook.links}
            selectedNode={canvasHook.selectedNode}
            expanded={componentsExpanded}
            appConfig={appConfig}
            containerManagerUrl={containerManagerUrl}
            selectedTopologyName={selectedTopologyName}
            topologies={operations.topologies}
            taps={(operations.topologyDetails as any)?.taps || []}
            triggers={(operations.topologyDetails as any)?.triggers || []}
            bgpSessions={(operations.topologyDetails as any)?.bgp_sessions || []}
            onToggleExpanded={() => setComponentsExpanded(!componentsExpanded)}
            onSelectNode={canvasHook.setSelectedNode}
            onDeployDaemon={panelActions.deployDaemon}
            onStopDaemon={panelActions.stopDaemon}
            onDeployNetwork={panelActions.deployNetwork}
            onDeployHost={panelActions.deployHost}
            onStopHost={panelActions.stopHost}
            onDeployBGPSession={panelActions.deployBGPSession}
            onEditDaemon={formsHook.openEditDaemonDialog}
            onEditHost={formsHook.openEditHostDialog}
            onEditNetwork={(network) => {
              alert('Network editing coming soon. Network: ' + network.name);
            }}
            onEditBGPSession={(bgpData) => {
              // Open BGP form with existing data for editing
              const sourceNode = canvasHook.nodes.find(n => n.id === bgpData.source);
              const targetNode = canvasHook.nodes.find(n => n.id === bgpData.target);
              if (sourceNode && targetNode) {
                dialogsHook.openBGPForm(sourceNode.data, targetNode.data);
              }
            }}
            onEditGRETunnel={(greData) => {
              // Open GRE tunnel dialog with existing data for editing
              const sourceNode = canvasHook.nodes.find(n => n.id === greData.source);
              const targetNode = canvasHook.nodes.find(n => n.id === greData.target);
              if (sourceNode && targetNode) {
                dialogsHook.openGRETunnelForm(
                  {
                    name: sourceNode.data?.name || '',
                    type: sourceNode.type as 'daemon' | 'host' | 'external_node',
                    interfaces: sourceNode.data?.interfaces || []
                  },
                  {
                    name: targetNode.data?.name || '',
                    type: targetNode.type as 'daemon' | 'host' | 'external_node',
                    interfaces: targetNode.data?.interfaces || []
                  }
                );
              }
            }}
            onDeleteBGPSession={handleDeleteBGPSession}
            onDeleteGRETunnel={handleDeleteGRETunnel}
            onDeleteNode={operations.handleDeleteNode}
            onDeployTap={handleDeployTap}
            onStopTap={handleStopTap}
            onEditTrigger={formsHook.openEditTriggerDialog}
            onDeleteTrigger={handleDeleteTrigger}
            refetchConfig={operations.refetchConfig}
          />
        </div>
      </div>

      {/* Fixed Controls */}
      <TopologyFixedControls
        topologies={operations.topologies}
        selectedTopologyName={selectedTopologyName}
        onSelectTopology={(name) => {
          setSelectedTopologyName(name);
          operations.loadTopologyDetails(name);
        }}
        onOpenCreateTopologyDialog={dialogsHook.openCreateTopologyDialog}
        onOpenEditTopology={formsHook.openEditTopologyDialog}
        onDeployTopology={handleDeployTopology}
        onStopTopology={handleStopTopology}
        onOpenCreateDaemon={formsHook.openCreateDaemonDialog}
        onOpenCreateHost={formsHook.openCreateHostDialog}
        onOpenNetworkDialog={dialogsHook.openNetworkDialog}
        onOpenExternalNodeDialog={dialogsHook.openExternalNodeDialog}
        onOpenExternalNetworkDialog={dialogsHook.openExternalNetworkDialog}
        onOpenRouteAdvertisementDialog={formsHook.openRouteAdvertisementDialog}
        onOpenTriggerDialog={formsHook.openTriggerDialog}
        onChangeMode={(mode) => {
          if (mode === 'quick-test') {
            // Open quick test pane immediately without node selection
            connectionHandlers.openQuickTestDirect();
          } else {
            canvasHook.changeMode(mode as any);
          }
        }}
        onOpenGRETunnelDialog={() => canvasHook.changeMode('add-gre-tunnel')}
        onExportJSON={exportHook.handleExportJSON}
        onExportPNG={exportHook.handleExportPNG}
        onExportSVG={exportHook.handleExportSVG}
      />

      {/* All Dialogs */}
      <TopologyDialogs
        // BGP Dialog
        showBGPForm={dialogsHook.showBGPForm}
        bgpFormData={dialogsHook.bgpFormData}
        onCloseBGPForm={dialogsHook.closeBGPForm}
        onBGPSuccess={connectionHandlers.handleBGPSuccess}
        containerManagerUrl={containerManagerUrl}

        // Network Selection Dialog
        showNetworkSelectionDialog={dialogsHook.showNetworkSelectionDialog}
        pendingLink={dialogsHook.pendingLink}
        onCloseNetworkSelectionDialog={dialogsHook.closeNetworkSelectionDialog}
        onNetworkSelected={connectionHandlers.handleNetworkSelected}
        onOpenNetworkDialog={dialogsHook.openNetworkDialog}
        findNode={canvasHook.findNode}
        networks={canvasHook.networks}
        nodes={canvasHook.nodes}
        topologyDetailsNetworks={operations.topologyDetails?.networks}
        onChangeMode={canvasHook.changeMode}

        // Network Dialog
        showNetworkDialog={dialogsHook.showNetworkDialog}
        networkForm={dialogsHook.networkForm}
        onCloseNetworkDialog={dialogsHook.closeNetworkDialog}
        onUpdateNetworkForm={dialogsHook.updateNetworkForm}
        onResetNetworkForm={dialogsHook.resetNetworkForm}
        onSaveNetwork={dialogHandlers.handleSaveNetwork}

        // External Node Dialog
        showExternalNodeDialog={dialogsHook.showExternalNodeDialog}
        externalNodeForm={dialogsHook.externalNodeForm}
        onCloseExternalNodeDialog={dialogsHook.closeExternalNodeDialog}
        onUpdateExternalNodeForm={dialogsHook.updateExternalNodeForm}
        onSaveExternalNode={dialogHandlers.handleSaveExternalNode}

        // External Network Dialog
        showExternalNetworkDialog={dialogsHook.showExternalNetworkDialog}
        externalNetworkForm={dialogsHook.externalNetworkForm}
        onCloseExternalNetworkDialog={dialogsHook.closeExternalNetworkDialog}
        onUpdateExternalNetworkForm={dialogsHook.updateExternalNetworkForm}
        onSaveExternalNetwork={dialogHandlers.handleSaveExternalNetwork}

        // Load Dialog
        showLoadDialog={dialogsHook.showLoadDialog}
        topologies={operations.topologies}
        activeTopology={operations.activeTopology}
        onCloseLoadDialog={dialogsHook.closeLoadDialog}
        onLoadTopology={(name) => {
          operations.loadTopologyDetails(name);
          dialogsHook.closeLoadDialog();
        }}
        onActivateTopology={async (name) => {
          await operations.activateTopology(name);
          dialogsHook.closeLoadDialog();
        }}
        onDeleteTopology={async (name) => {
          await operations.deleteTopology(name);
        }}

        // Create Topology Dialog
        showCreateTopologyDialog={dialogsHook.showCreateTopologyDialog}
        newBackendTopologyName={dialogsHook.newBackendTopologyName}
        newBackendTopologyDescription={dialogsHook.newBackendTopologyDescription}
        newBackendTopologyMgmtNetwork={dialogsHook.newBackendTopologyMgmtNetwork}
        availableNetworks={dialogsHook.availableNetworks}
        onCloseCreateTopologyDialog={dialogsHook.closeCreateTopologyDialog}
        onUpdateTopologyName={dialogsHook.updateTopologyName}
        onUpdateTopologyDescription={dialogsHook.updateTopologyDescription}
        onUpdateTopologyMgmtNetwork={dialogsHook.updateTopologyMgmtNetwork}
        onCreateTopology={dialogHandlers.handleCreateTopology}

        // Edit Topology Dialog
        showEditTopology={formsHook.showEditTopology}
        editTopologyForm={formsHook.editTopologyForm}
        selectedTopologyName={selectedTopologyName}
        onCloseEditTopology={formsHook.closeEditTopologyDialog}
        onUpdateEditTopologyForm={formsHook.updateEditTopologyForm}
        onSaveTopologyEdit={dialogHandlers.handleSaveTopologyEdit}

        // Export Dialog
        showExportDialog={exportHook.showExportDialog}
        onCloseExportDialog={exportHook.closeExportDialog}
        onExportJSON={exportHook.handleExportJSON}
        onExportPNG={exportHook.handleExportPNG}
        onExportSVG={exportHook.handleExportSVG}

        // Create Daemon Dialog
        showCreateDaemon={formsHook.showCreateDaemon}
        newDaemon={formsHook.newDaemon}
        editingDaemonName={formsHook.editingDaemonName}
        onCloseCreateDaemon={formsHook.closeCreateDaemonDialog}
        onUpdateNewDaemon={formsHook.updateDaemonForm}
        onSaveDaemon={dialogHandlers.handleSaveDaemonDialog}

        // Create Host Dialog
        showCreateHost={formsHook.showCreateHost}
        newHostForm={formsHook.newHostForm}
        editingHostName={formsHook.editingHostName}
        daemonsWithInterfaces={operations.daemonsWithInterfaces}
        onCloseCreateHost={formsHook.closeCreateHostDialog}
        onUpdateNewHostForm={formsHook.updateHostForm}
        onSaveHost={dialogHandlers.handleSaveHostDialog}

        // Route Advertisement Dialog
        showRouteAdvertisementDialog={formsHook.showRouteAdvertisementDialog}
        onCloseRouteAdvertisementDialog={formsHook.closeRouteAdvertisementDialog}

        // Trigger Dialog
        showTriggerDialog={formsHook.showTriggerDialog}
        triggerFormState={formsHook.triggerFormState}
        editingTriggerId={formsHook.editingTriggerId}
        onCloseTriggerDialog={formsHook.closeTriggerDialog}
        onUpdateTriggerForm={formsHook.updateTriggerForm}
        onSubmitTrigger={dialogHandlers.handleSubmitTriggerDialog}

        // GRE Tunnel Dialog
        showGRETunnelDialog={dialogsHook.showGRETunnelDialog}
        greTunnelFormData={dialogsHook.greTunnelFormData}
        onCloseGRETunnelDialog={dialogsHook.closeGRETunnelDialog}
        onGRETunnelSuccess={dialogHandlers.handleGRETunnelSuccess}
        availableNodesForGRE={availableNodesForGRE}
      />


      {/* Tap Dialog */}
      <TapDialog
        isOpen={connectionHandlers.showTapDialog}
        onClose={connectionHandlers.closeTapDialog}
        containerManagerUrl={containerManagerUrl}
        appConfig={appConfig}
        topologyDetails={operations.topologyDetails}
        topologyName={selectedTopologyName}
        onTapCreated={() => {
          // Refresh config to show new tap
          operations.refetchConfig();
        }}
        preselectedContainer={connectionHandlers.preselectedContainer}
      />
    </PageLayout>
  );
};

export default TopologyBuilder;
