import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ActiveTest, TestParameters } from '../services/networkTestingService';

export interface TestResult {
  id: string;
  tool: string;
  sourceIP: string;
  targetIP: string;
  startTime: string;
  endTime?: string;
  status: 'running' | 'finished' | 'error';
  output: string[];
  error?: string;
}

export interface NetworkTestingState {
  // Active tests across all hosts
  activeTests: Record<string, ActiveTest[]>; // Keyed by host API port

  // Current test being run
  currentTest: {
    id: string | null;
    tool: TestParameters['tool'] | null;
    sourceIP: string | null;
    targetIP: string | null;
    isRunning: boolean;
    output: string[];
    error: string | null;
  };

  // Test being viewed
  viewingTest: {
    id: string | null;
    output: string[];
  };

  // Test results history
  testHistory: TestResult[];

  // UI state
  selectedTool: TestParameters['tool'];
  selectedSourceHost: string;
  selectedSourceIP: string;
  selectedTargetHost: string;
  selectedTargetIP: string;
  activeTab: 'test' | 'active' | 'hosts';
}

const initialState: NetworkTestingState = {
  activeTests: {},
  currentTest: {
    id: null,
    tool: null,
    sourceIP: null,
    targetIP: null,
    isRunning: false,
    output: [],
    error: null
  },
  viewingTest: {
    id: null,
    output: []
  },
  testHistory: [],
  selectedTool: 'ping',
  selectedSourceHost: '',
  selectedSourceIP: '',
  selectedTargetHost: '',
  selectedTargetIP: '',
  activeTab: 'test'
};

const networkTestingSlice = createSlice({
  name: 'networkTesting',
  initialState,
  reducers: {
    // Active tests management
    setActiveTests: (state, action: PayloadAction<{ hostPort: string; tests: ActiveTest[] }>) => {
      state.activeTests[action.payload.hostPort] = action.payload.tests;
    },

    clearActiveTests: (state, action: PayloadAction<string>) => {
      delete state.activeTests[action.payload];
    },

    // Current test management
    startTest: (state, action: PayloadAction<{
      id: string;
      tool: TestParameters['tool'];
      sourceIP: string;
      targetIP: string;
    }>) => {
      state.currentTest = {
        id: action.payload.id,
        tool: action.payload.tool,
        sourceIP: action.payload.sourceIP,
        targetIP: action.payload.targetIP,
        isRunning: true,
        output: [],
        error: null
      };
    },

    appendTestOutput: (state, action: PayloadAction<string>) => {
      state.currentTest.output.push(action.payload);
    },

    setTestError: (state, action: PayloadAction<string>) => {
      state.currentTest.error = action.payload;
      state.currentTest.isRunning = false;
    },

    finishTest: (state) => {
      if (state.currentTest.id) {
        // Add to history
        const result: TestResult = {
          id: state.currentTest.id,
          tool: state.currentTest.tool!,
          sourceIP: state.currentTest.sourceIP!,
          targetIP: state.currentTest.targetIP!,
          startTime: new Date().toISOString(),
          status: state.currentTest.error ? 'error' : 'finished',
          output: [...state.currentTest.output],
          error: state.currentTest.error || undefined
        };

        state.testHistory.unshift(result);

        // Keep only last 50 tests in history
        if (state.testHistory.length > 50) {
          state.testHistory = state.testHistory.slice(0, 50);
        }
      }

      state.currentTest.isRunning = false;
    },

    clearCurrentTest: (state) => {
      state.currentTest = {
        id: null,
        tool: null,
        sourceIP: null,
        targetIP: null,
        isRunning: false,
        output: [],
        error: null
      };
    },

    // Viewing test management
    startViewingTest: (state, action: PayloadAction<string>) => {
      state.viewingTest = {
        id: action.payload,
        output: []
      };
    },

    appendViewingOutput: (state, action: PayloadAction<string>) => {
      state.viewingTest.output.push(action.payload);
    },

    stopViewingTest: (state) => {
      state.viewingTest = {
        id: null,
        output: []
      };
    },

    // UI state management
    setSelectedTool: (state, action: PayloadAction<TestParameters['tool']>) => {
      state.selectedTool = action.payload;
    },

    setSelectedSourceHost: (state, action: PayloadAction<string>) => {
      state.selectedSourceHost = action.payload;
    },

    setSelectedSourceIP: (state, action: PayloadAction<string>) => {
      state.selectedSourceIP = action.payload;
    },

    setSelectedTargetHost: (state, action: PayloadAction<string>) => {
      state.selectedTargetHost = action.payload;
    },

    setSelectedTargetIP: (state, action: PayloadAction<string>) => {
      state.selectedTargetIP = action.payload;
    },

    setActiveTab: (state, action: PayloadAction<'test' | 'active' | 'hosts'>) => {
      state.activeTab = action.payload;
    },

    // Clear all state
    clearAllTestingState: (state) => {
      return initialState;
    }
  }
});

export const {
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
  setActiveTab,
  clearAllTestingState
} = networkTestingSlice.actions;

export default networkTestingSlice.reducer;