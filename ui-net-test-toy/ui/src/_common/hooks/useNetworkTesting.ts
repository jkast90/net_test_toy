import { useCallback, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useLabManager } from './useLabManager';
import {
  setActiveTests,
  clearActiveTests,
  startTest,
  appendTestOutput,
  setTestError,
  finishTest,
  clearCurrentTest,
  startViewingTest,
  appendViewingOutput,
  stopViewingTest,
  setSelectedTool,
  setSelectedSourceHost,
  setSelectedSourceIP,
  setSelectedTargetHost,
  setSelectedTargetIP,
  setActiveTab
} from '../store/networkTestingSlice';
import {
  selectActiveTests,
  selectCurrentTest,
  selectViewingTest,
  selectTestHistory,
  selectSelectedTool,
  selectSelectedSourceHost,
  selectSelectedSourceIP,
  selectSelectedTargetHost,
  selectSelectedTargetIP,
  selectActiveTab,
  selectIsTestRunning,
  selectTestConfiguration
} from '../store/networkTestingSelectors';
import { networkTestingService, TestParameters } from '../services/networkTestingService';
import { getAllIPs } from '../utils/networkUtils';

export const useNetworkTesting = () => {
  const dispatch = useAppDispatch();
  const { managedHosts, selectedHostId, labHosts } = useLabManager();

  // WebSocket refs
  const testWsRef = useRef<WebSocket | null>(null);
  const viewWsRef = useRef<WebSocket | null>(null);
  const activeMonitorWsRef = useRef<WebSocket | null>(null);

  // Selectors
  const activeTests = useAppSelector(selectActiveTests);
  const currentTest = useAppSelector(selectCurrentTest);
  const viewingTest = useAppSelector(selectViewingTest);
  const testHistory = useAppSelector(selectTestHistory);
  const selectedTool = useAppSelector(selectSelectedTool);
  const selectedSourceHost = useAppSelector(selectSelectedSourceHost);
  const selectedSourceIP = useAppSelector(selectSelectedSourceIP);
  const selectedTargetHost = useAppSelector(selectSelectedTargetHost);
  const selectedTargetIP = useAppSelector(selectSelectedTargetIP);
  const activeTab = useAppSelector(selectActiveTab);
  const isRunning = useAppSelector(selectIsTestRunning);
  const testConfig = useAppSelector(selectTestConfiguration);

  // Get current host URL (from Lab Manager)
  const currentHostUrl = managedHosts.find(h => h.id === selectedHostId)?.url || '';

  // Run a network test
  // Optional sourceHost/targetHost params allow direct host specification (bypasses store state)
  const runTest = useCallback(async (params: TestParameters, options?: { sourceHost?: string; targetHost?: string }) => {
    if (!currentHostUrl) {
      dispatch(setTestError('No host URL configured'));
      return;
    }

    // Use explicit hosts if provided, otherwise fall back to store state
    const effectiveSourceHost = options?.sourceHost || selectedSourceHost;
    const effectiveTargetHost = options?.targetHost || selectedTargetHost;

    if (!effectiveSourceHost) {
      dispatch(setTestError('No source host selected'));
      return;
    }

    // Close existing test WebSocket if any
    if (testWsRef.current) {
      testWsRef.current.close();
    }

    const testId = `test-${Date.now()}`;
    dispatch(startTest({
      id: testId,
      tool: params.tool,
      sourceIP: params.params.source_ip || '',
      targetIP: params.params.server || params.params.host || ''
    }));

    console.log('[useNetworkTesting] Starting test:', { testId, params, effectiveSourceHost, effectiveTargetHost });

    // Special handling for iperf: start server on target first
    if (params.tool === 'iperf') {
      console.log('[useNetworkTesting] Starting iperf server on target host...');
      console.log('[useNetworkTesting] Target host:', effectiveTargetHost);
      console.log('[useNetworkTesting] Server IP to bind:', params.params.server);
      dispatch(appendTestOutput('Starting iperf server on target host...'));

      // Start server on target
      const serverParams: TestParameters = {
        tool: 'iperf',
        params: {
          source_ip: params.params.server, // Target's IP to bind to
          host: params.params.server,      // Required field
          server: params.params.server,
          port: params.params.port,
          server_mode: true
        }
      };

      // Start server and monitor for confirmation
      let serverReady = false;
      networkTestingService.startTest(
        currentHostUrl,
        effectiveTargetHost || '',
        serverParams,
        (msg) => {
          console.log('[useNetworkTesting] Server message:', msg);
          if (msg.output) {
            // Server outputs "Server listening on ..." when ready
            if (msg.output.includes('Server listening') || msg.output.includes('Accepted connection')) {
              serverReady = true;
            }
            // Also show server output for debugging
            dispatch(appendTestOutput(`[Server] ${msg.output}`));
          }
          if (msg.error) {
            console.error('[useNetworkTesting] Server error:', msg.error);
            dispatch(setTestError(`Server error: ${msg.error}`));
          }
        },
        (error) => {
          console.error('[useNetworkTesting] Server WebSocket error:', error);
          dispatch(setTestError(`Server WebSocket error: ${error.message}`));
        },
        () => {
          console.log('[useNetworkTesting] Server WebSocket closed');
        }
      );

      // Wait for server to start (with timeout)
      dispatch(appendTestOutput('Waiting for iperf server to be ready...'));
      const startTime = Date.now();
      while (!serverReady && Date.now() - startTime < 5000) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      if (!serverReady) {
        console.warn('[useNetworkTesting] Server did not report ready status, proceeding anyway...');
        dispatch(appendTestOutput('Warning: Server did not confirm ready status'));
      }

      dispatch(appendTestOutput('Starting iperf client...'));
    }

    testWsRef.current = networkTestingService.startTest(
      currentHostUrl,
      effectiveSourceHost,
      params,
      (msg) => {
        console.log('[useNetworkTesting] Received message:', msg);
        if (msg.output) {
          dispatch(appendTestOutput(msg.output));
          // Auto-finish test when process exits
          if (msg.output.includes('process exited')) {
            console.log('[useNetworkTesting] Test process exited, finishing test');
            dispatch(finishTest());
          }
        }
        if (msg.error) {
          console.error('[useNetworkTesting] Test error:', msg.error);
          dispatch(setTestError(msg.error));
        }
        if (msg.status === 'finished') {
          console.log('[useNetworkTesting] Test finished by server');
          dispatch(finishTest());
        }
      },
      (error) => {
        console.error('[useNetworkTesting] WebSocket error:', error);
        dispatch(setTestError(error.message));
      },
      () => {
        console.log('[useNetworkTesting] WebSocket closed');
        dispatch(finishTest());
        testWsRef.current = null;
      }
    );
  }, [dispatch, selectedSourceHost, selectedTargetHost]);

  // Stop current test
  const stopCurrentTest = useCallback(() => {
    if (testWsRef.current) {
      testWsRef.current.close();
      testWsRef.current = null;
    }
    dispatch(clearCurrentTest());
  }, [dispatch]);

  // Stop any test by ID
  const stopTest = useCallback(async (testId: string) => {
    if (!currentHostUrl || !selectedSourceHost) return;
    try {
      await networkTestingService.stopTest(currentHostUrl, selectedSourceHost, testId);
      console.log(`[useNetworkTesting] Stopped test ${testId}`);
    } catch (error) {
      console.error(`[useNetworkTesting] Failed to stop test ${testId}:`, error);
    }
  }, [currentHostUrl, selectedSourceHost]);

  // View test output
  const viewTestOutput = useCallback((testId: string) => {
    if (!currentHostUrl || !selectedSourceHost) return;

    // Close existing view WebSocket if any
    if (viewWsRef.current) {
      viewWsRef.current.close();
    }

    dispatch(startViewingTest(testId));

    viewWsRef.current = networkTestingService.viewTestOutput(
      currentHostUrl,
      selectedSourceHost,
      testId,
      (output) => {
        dispatch(appendViewingOutput(output));
      },
      (error) => {
        console.error('Error viewing test:', error);
        dispatch(stopViewingTest());
      },
      () => {
        viewWsRef.current = null;
      }
    );
  }, [dispatch, currentHostUrl, selectedSourceHost]);

  // Stop viewing test
  const stopViewingTestOutput = useCallback(() => {
    if (viewWsRef.current) {
      viewWsRef.current.close();
      viewWsRef.current = null;
    }
    dispatch(stopViewingTest());
  }, [dispatch]);

  // Monitor active tests for a host
  const monitorActiveTests = useCallback(() => {
    if (!currentHostUrl || !selectedSourceHost) return;

    // Close existing monitor WebSocket if any
    if (activeMonitorWsRef.current) {
      activeMonitorWsRef.current.close();
    }

    activeMonitorWsRef.current = networkTestingService.monitorActiveTests(
      currentHostUrl,
      selectedSourceHost,
      (tests) => {
        dispatch(setActiveTests({ hostPort: currentHostUrl, tests }));
      },
      (error) => {
        console.error('Error monitoring active tests:', error);
        dispatch(clearActiveTests(currentHostUrl));
      }
    );
  }, [dispatch, currentHostUrl, selectedSourceHost]);

  // Stop monitoring active tests
  const stopMonitoringActiveTests = useCallback(() => {
    if (activeMonitorWsRef.current) {
      activeMonitorWsRef.current.close();
      activeMonitorWsRef.current = null;
    }
  }, []);

  // Build test parameters helper
  const buildTestParameters = useCallback(
    (options: Record<string, any>): TestParameters => {
      return networkTestingService.buildTestParameters(
        selectedTool,
        selectedSourceIP,
        selectedTargetIP,
        options
      );
    },
    [selectedTool, selectedSourceIP, selectedTargetIP]
  );

  // UI setters
  const selectTool = useCallback((tool: TestParameters['tool']) => {
    dispatch(setSelectedTool(tool));
  }, [dispatch]);

  const selectSourceHost = useCallback((host: string) => {
    dispatch(setSelectedSourceHost(host));
  }, [dispatch]);

  const selectSourceIP = useCallback((ip: string) => {
    dispatch(setSelectedSourceIP(ip));
  }, [dispatch]);

  const selectTargetHost = useCallback((host: string) => {
    dispatch(setSelectedTargetHost(host));
  }, [dispatch]);

  const selectTargetIP = useCallback((ip: string) => {
    dispatch(setSelectedTargetIP(ip));
  }, [dispatch]);

  const changeActiveTab = useCallback((tab: 'test' | 'active' | 'hosts') => {
    dispatch(setActiveTab(tab));
  }, [dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (testWsRef.current) {
        testWsRef.current.close();
      }
      if (viewWsRef.current) {
        viewWsRef.current.close();
      }
      if (activeMonitorWsRef.current) {
        activeMonitorWsRef.current.close();
      }
    };
  }, []);

  // Auto-select first hosts when lab hosts are loaded
  useEffect(() => {
    if (labHosts.length > 0 && !selectedSourceHost) {
      selectSourceHost(labHosts[0].name);

      // Get IPs from first host using utility (properly strips CIDR)
      const sourceIPs = getAllIPs(labHosts[0]);
      if (sourceIPs.length > 0) {
        selectSourceIP(sourceIPs[0].ip);
      }

      // Select target if available
      if (labHosts.length > 1) {
        selectTargetHost(labHosts[1].name);

        const targetIPs = getAllIPs(labHosts[1]);
        if (targetIPs.length > 0) {
          selectTargetIP(targetIPs[0].ip);
        }
      }
    }
  }, [labHosts, selectedSourceHost, selectSourceHost, selectSourceIP, selectTargetHost, selectTargetIP]);

  return {
    // State
    activeTests,
    currentTest,
    viewingTest,
    testHistory,
    selectedTool,
    selectedSourceHost,
    selectedSourceIP,
    selectedTargetHost,
    selectedTargetIP,
    activeTab,
    isRunning,
    testConfig,
    labHosts,

    // Actions
    runTest,
    stopCurrentTest,
    stopTest,
    viewTestOutput,
    stopViewingTestOutput,
    monitorActiveTests,
    stopMonitoringActiveTests,
    buildTestParameters,
    selectTool,
    selectSourceHost,
    selectSourceIP,
    selectTargetHost,
    selectTargetIP,
    changeActiveTab
  };
};