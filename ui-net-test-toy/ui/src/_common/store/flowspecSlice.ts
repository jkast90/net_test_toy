import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { flowspecService, FlowSpecRule } from '../services/flowspecService';

export interface FlowSpecState {
  // Rules by client URL
  rulesByClient: Record<string, FlowSpecRule[]>;

  // Loading states
  isLoading: boolean;
  isDeleting: boolean;
  isCreating: boolean;

  // Error states
  error: string | null;

  // Success message
  successMessage: string | null;

  // Currently selected backend
  selectedBackend: string;
}

const initialState: FlowSpecState = {
  rulesByClient: {},
  isLoading: false,
  isDeleting: false,
  isCreating: false,
  error: null,
  successMessage: null,
  selectedBackend: 'gobgp'
};

// Async thunks
export const fetchFlowSpecRules = createAsyncThunk(
  'flowspec/fetchRules',
  async ({ clientUrl, backend = 'gobgp' }: { clientUrl: string; backend?: string }) => {
    const rules = await flowspecService.fetchRules(clientUrl, backend);
    return { clientUrl, rules };
  }
);

export const createFlowSpecRule = createAsyncThunk(
  'flowspec/createRule',
  async ({ clientUrl, rule, backend = 'gobgp' }: { clientUrl: string; rule: FlowSpecRule; backend?: string }) => {
    await flowspecService.createRule(clientUrl, rule, backend);
    // Refetch rules after creation
    const rules = await flowspecService.fetchRules(clientUrl, backend);
    return { clientUrl, rules };
  }
);

export const deleteFlowSpecRule = createAsyncThunk(
  'flowspec/deleteRule',
  async ({ clientUrl, rule, backend = 'gobgp' }: { clientUrl: string; rule: FlowSpecRule; backend?: string }) => {
    await flowspecService.deleteRule(
      clientUrl,
      {
        family: rule.family || 'ipv4',
        match: rule.match,
        actions: rule.actions
      },
      backend
    );
    // Refetch rules after deletion
    const rules = await flowspecService.fetchRules(clientUrl, backend);
    return { clientUrl, rules };
  }
);

export const cancelFlowSpecMitigation = createAsyncThunk(
  'flowspec/cancelMitigation',
  async ({
    clientUrl,
    flow,
    backend = 'gobgp'
  }: {
    clientUrl: string;
    flow: {
      src_addr: string;
      dst_addr: string;
      src_port?: number;
      dst_port?: number;
      protocol?: number;
    };
    backend?: string;
  }) => {
    await flowspecService.cancelMitigation(clientUrl, flow, backend);
    // Refetch rules after cancellation
    const rules = await flowspecService.fetchRules(clientUrl, backend);
    return { clientUrl, rules };
  }
);

const flowspecSlice = createSlice({
  name: 'flowspec',
  initialState,
  reducers: {
    setSelectedBackend: (state, action: PayloadAction<string>) => {
      state.selectedBackend = action.payload;
    },

    clearError: (state) => {
      state.error = null;
    },

    clearSuccessMessage: (state) => {
      state.successMessage = null;
    },

    resetFlowSpecState: () => initialState
  },
  extraReducers: (builder) => {
    // Fetch rules
    builder
      .addCase(fetchFlowSpecRules.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchFlowSpecRules.fulfilled, (state, action) => {
        state.isLoading = false;
        state.rulesByClient[action.payload.clientUrl] = action.payload.rules;
      })
      .addCase(fetchFlowSpecRules.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch FlowSpec rules';
      });

    // Create rule
    builder
      .addCase(createFlowSpecRule.pending, (state) => {
        state.isCreating = true;
        state.error = null;
      })
      .addCase(createFlowSpecRule.fulfilled, (state, action) => {
        state.isCreating = false;
        state.rulesByClient[action.payload.clientUrl] = action.payload.rules;
        state.successMessage = 'FlowSpec rule created successfully';
      })
      .addCase(createFlowSpecRule.rejected, (state, action) => {
        state.isCreating = false;
        state.error = action.error.message || 'Failed to create FlowSpec rule';
      });

    // Delete rule
    builder
      .addCase(deleteFlowSpecRule.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(deleteFlowSpecRule.fulfilled, (state, action) => {
        state.isDeleting = false;
        state.rulesByClient[action.payload.clientUrl] = action.payload.rules;
        state.successMessage = 'FlowSpec rule deleted successfully';
      })
      .addCase(deleteFlowSpecRule.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.error.message || 'Failed to delete FlowSpec rule';
      });

    // Cancel mitigation
    builder
      .addCase(cancelFlowSpecMitigation.pending, (state) => {
        state.isDeleting = true;
        state.error = null;
      })
      .addCase(cancelFlowSpecMitigation.fulfilled, (state, action) => {
        state.isDeleting = false;
        state.rulesByClient[action.payload.clientUrl] = action.payload.rules;
        state.successMessage = 'FlowSpec mitigation cancelled successfully';
      })
      .addCase(cancelFlowSpecMitigation.rejected, (state, action) => {
        state.isDeleting = false;
        state.error = action.error.message || 'Failed to cancel FlowSpec mitigation';
      });
  }
});

export const {
  setSelectedBackend,
  clearError,
  clearSuccessMessage,
  resetFlowSpecState
} = flowspecSlice.actions;

export default flowspecSlice.reducer;