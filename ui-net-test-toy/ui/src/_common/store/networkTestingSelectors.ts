import { createSelector } from '@reduxjs/toolkit';
import { RootState } from './store';
import { ActiveTest, TestResult } from './networkTestingSlice';

// Base selectors
export const selectNetworkTestingState = (state: RootState) => state.networkTesting;

export const selectActiveTests = createSelector(
  [selectNetworkTestingState],
  (networkTesting) => networkTesting.activeTests
);

export const selectCurrentTest = createSelector(
  [selectNetworkTestingState],
  (networkTesting) => networkTesting.currentTest
);

export const selectViewingTest = createSelector(
  [selectNetworkTestingState],
  (networkTesting) => networkTesting.viewingTest
);

export const selectTestHistory = createSelector(
  [selectNetworkTestingState],
  (networkTesting) => networkTesting.testHistory
);

// UI state selectors
export const selectSelectedTool = createSelector(
  [selectNetworkTestingState],
  (networkTesting) => networkTesting.selectedTool
);

export const selectSelectedSourceHost = createSelector(
  [selectNetworkTestingState],
  (networkTesting) => networkTesting.selectedSourceHost
);

export const selectSelectedSourceIP = createSelector(
  [selectNetworkTestingState],
  (networkTesting) => networkTesting.selectedSourceIP
);

export const selectSelectedTargetHost = createSelector(
  [selectNetworkTestingState],
  (networkTesting) => networkTesting.selectedTargetHost
);

export const selectSelectedTargetIP = createSelector(
  [selectNetworkTestingState],
  (networkTesting) => networkTesting.selectedTargetIP
);

export const selectActiveTab = createSelector(
  [selectNetworkTestingState],
  (networkTesting) => networkTesting.activeTab
);

// Derived selectors
export const selectIsTestRunning = createSelector(
  [selectCurrentTest],
  (currentTest) => currentTest.isRunning
);

export const selectCurrentTestOutput = createSelector(
  [selectCurrentTest],
  (currentTest) => currentTest.output
);

export const selectCurrentTestError = createSelector(
  [selectCurrentTest],
  (currentTest) => currentTest.error
);

export const selectViewingTestOutput = createSelector(
  [selectViewingTest],
  (viewingTest) => viewingTest.output
);

// Get all active tests from all hosts
export const selectAllActiveTests = createSelector(
  [selectActiveTests],
  (activeTestsByHost): ActiveTest[] => {
    const allTests: ActiveTest[] = [];
    Object.values(activeTestsByHost).forEach(tests => {
      allTests.push(...tests);
    });
    return allTests;
  }
);

// Get active tests for a specific host
export const selectActiveTestsForHost = createSelector(
  [selectActiveTests, (_: RootState, hostPort: string) => hostPort],
  (activeTestsByHost, hostPort) => activeTestsByHost[hostPort] || []
);

// Get running tests only
export const selectRunningTests = createSelector(
  [selectAllActiveTests],
  (tests) => tests.filter(test => test.status === 'running')
);

// Get test history by tool
export const selectTestHistoryByTool = createSelector(
  [selectTestHistory, (_: RootState, tool?: string) => tool],
  (history, tool) => {
    if (!tool) return history;
    return history.filter(test => test.tool === tool);
  }
);

// Get recent test results (last 10)
export const selectRecentTestResults = createSelector(
  [selectTestHistory],
  (history) => history.slice(0, 10)
);

// Check if there are any active tests
export const selectHasActiveTests = createSelector(
  [selectAllActiveTests],
  (tests) => tests.length > 0
);

// Check if currently viewing a test
export const selectIsViewingTest = createSelector(
  [selectViewingTest],
  (viewingTest) => viewingTest.id !== null
);

// Get test configuration summary
export const selectTestConfiguration = createSelector(
  [selectSelectedTool, selectSelectedSourceIP, selectSelectedTargetIP],
  (tool, sourceIP, targetIP) => ({
    tool,
    sourceIP,
    targetIP,
    isConfigured: !!(tool && sourceIP && targetIP)
  })
);