import React, { useEffect } from 'react';
import { useNetworkTesting, useNetworkTestingParams } from '../../_common/hooks';
import Card from '../../_common/components/Card';
import { EmptyState } from '../../_common/components/ui';
import styles from './NetworkTesting.module.css';
import { NavBarPageHeader } from '../../_common/components/layout';
import {
  TestConfigurationPane,
  ActiveTestsPane,
  HostsPane,
  TestOutputPane
} from '../components/NetworkTesting';
import { getAllIPs } from '../../_common/utils/networkUtils';

interface NetworkTestingProps {
  showAsPane?: boolean;
}

const NetworkTesting: React.FC<NetworkTestingProps> = ({ showAsPane = true }) => {
  const {
    // State from Redux
    activeTests,
    currentTest,
    viewingTest,
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
  } = useNetworkTesting();

  // Tool-specific parameters from hook
  const {
    pingParams,
    setPingParams,
    traceParams,
    setTraceParams,
    iperfParams,
    setIperfParams,
    hpingParams,
    setHpingParams,
    curlParams,
    setCurlParams,
    applyPreset,
    getToolOptions
  } = useNetworkTestingParams();

  // Monitor active tests for the first host on mount
  useEffect(() => {
    if (labHosts.length > 0) {
      const firstHost = labHosts[0];
      if (firstHost.api_port) {
        monitorActiveTests(firstHost.api_port);
      }
    }

    return () => {
      stopMonitoringActiveTests();
    };
  }, [labHosts, monitorActiveTests, stopMonitoringActiveTests]);

  // Handler for running tests - just builds options and calls hook method
  const handleRunTest = () => {
    if (!selectedSourceIP || !selectedTargetIP) return;

    // Stop viewing any previous test so output pane connects to new test
    if (viewingTest.id) {
      stopViewingTestOutput();
    }

    const options = getToolOptions(selectedTool);
    const params = buildTestParameters(options);
    runTest(params);
  };

  // Handler for source IP change with auto-detection of host
  const handleSourceIPChange = (ip: string) => {
    selectSourceIP(ip);
    const sourceHost = labHosts.find(host =>
      getAllIPs(host).some(({ ip: hostIp }) => hostIp === ip)
    );
    if (sourceHost) {
      selectSourceHost(sourceHost.name);
    }
  };

  // Handler for target IP change with auto-detection of host
  const handleTargetIPChange = (ip: string) => {
    selectTargetIP(ip);
    const targetHost = labHosts.find(host =>
      getAllIPs(host).some(({ ip: hostIp }) => hostIp === ip)
    );
    if (targetHost) {
      selectTargetHost(targetHost.name);
    }
  };

  // Handler for viewing test output
  const handleViewTestOutput = (testId: string) => {
    viewTestOutput(testId);
  };

  // Handler for stopping a test
  const handleStopTest = (testId: string, hostPort: string) => {
    stopTest(hostPort, testId);
  };

  // Computed values for display
  const displayOutput = viewingTest.id ? viewingTest.output : currentTest.output;
  const runningTestsCount = Object.values(activeTests).flat().filter(t => t.status === 'running').length;

  if (labHosts.length === 0) {
    return (
      <div className={styles.container}>
        <NavBarPageHeader
          title="Network Testing"
          subtitle="Run network diagnostics and tests between hosts"
        />
        <Card>
          <EmptyState
            message="No hosts available. Create hosts first using the Environment Manager."
          />
        </Card>
      </div>
    );
  }

  const mainContent = (
    <>
      <div className={styles.layout}>
        {/* Left Panel - Tab Navigation + Tab Content */}
        <div>
          {/* Tab Navigation */}
          <div className={styles.tabNav}>
            <button
              className={`${styles.tab} ${activeTab === 'test' ? styles.active : ''}`}
              onClick={() => changeActiveTab('test')}
            >
              Run Test
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'active' ? styles.active : ''}`}
              onClick={() => changeActiveTab('active')}
            >
              Active Tests {runningTestsCount > 0 && (
                <span className={styles.badge}>{runningTestsCount}</span>
              )}
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'hosts' ? styles.active : ''}`}
              onClick={() => changeActiveTab('hosts')}
            >
              Hosts ({labHosts.length})
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'test' && (
            <TestConfigurationPane
              selectedSourceIP={selectedSourceIP}
              selectedTargetIP={selectedTargetIP}
              selectedSourceHost={selectedSourceHost}
              selectedTool={selectedTool}
              pingParams={pingParams}
              traceParams={traceParams}
              iperfParams={iperfParams}
              hpingParams={hpingParams}
              curlParams={curlParams}
              setPingParams={setPingParams}
              setTraceParams={setTraceParams}
              setIperfParams={setIperfParams}
              setHpingParams={setHpingParams}
              setCurlParams={setCurlParams}
              onSourceIPChange={handleSourceIPChange}
              onTargetIPChange={handleTargetIPChange}
              onToolChange={(tool) => selectTool(tool as any)}
              onRunTest={handleRunTest}
              onStopTest={stopCurrentTest}
              onPresetApply={applyPreset}
              labHosts={labHosts}
              isRunning={isRunning}
              isConfigured={testConfig.isConfigured}
              error={currentTest.error}
            />
          )}

          {activeTab === 'active' && (
            <ActiveTestsPane
              activeTests={activeTests}
              viewingTestId={viewingTest.id}
              onTestClick={handleViewTestOutput}
              onStopTest={handleStopTest}
            />
          )}

          {activeTab === 'hosts' && (
            <HostsPane hosts={labHosts} />
          )}
        </div>

        {/* Right Panel - Output */}
        <div>
          <TestOutputPane
            output={displayOutput}
            viewingTestId={viewingTest.id}
            onDisconnect={stopViewingTestOutput}
            isRunning={isRunning}
            currentTestId={currentTest.id || undefined}
            error={currentTest.error || undefined}
          />
        </div>
      </div>
    </>
  );

  if (showAsPane) {
    return (
      <div className={styles.container}>
        <NavBarPageHeader
          title="Network Testing"
          subtitle="Run network diagnostics and tests between hosts"
        />
        {mainContent}
      </div>
    );
  }

  return mainContent;
};

export default NetworkTesting;