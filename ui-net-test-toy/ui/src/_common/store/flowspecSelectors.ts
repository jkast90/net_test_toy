import { createSelector } from '@reduxjs/toolkit';
import { RootState } from './store';

// Base selectors
export const selectFlowSpecState = (state: RootState) => state.flowspec;

export const selectFlowSpecRulesByClient = createSelector(
  [selectFlowSpecState],
  (flowspec) => flowspec.rulesByClient
);

export const selectFlowSpecRulesForClient = createSelector(
  [selectFlowSpecRulesByClient, (_: RootState, clientUrl: string) => clientUrl],
  (rulesByClient, clientUrl) => rulesByClient[clientUrl] || []
);

export const selectAllFlowSpecRules = createSelector(
  [selectFlowSpecRulesByClient],
  (rulesByClient) => {
    const allRules: any[] = [];
    Object.entries(rulesByClient).forEach(([clientUrl, rules]) => {
      rules.forEach(rule => {
        allRules.push({ ...rule, clientUrl });
      });
    });
    return allRules;
  }
);

export const selectFlowSpecSelectedBackend = createSelector(
  [selectFlowSpecState],
  (flowspec) => flowspec.selectedBackend
);

// Loading states
export const selectFlowSpecIsLoading = createSelector(
  [selectFlowSpecState],
  (flowspec) => flowspec.isLoading
);

export const selectFlowSpecIsDeleting = createSelector(
  [selectFlowSpecState],
  (flowspec) => flowspec.isDeleting
);

export const selectFlowSpecIsCreating = createSelector(
  [selectFlowSpecState],
  (flowspec) => flowspec.isCreating
);

// Error and success states
export const selectFlowSpecError = createSelector(
  [selectFlowSpecState],
  (flowspec) => flowspec.error
);

export const selectFlowSpecSuccessMessage = createSelector(
  [selectFlowSpecState],
  (flowspec) => flowspec.successMessage
);

// Derived selectors
export const selectFlowSpecRuleCount = createSelector(
  [selectAllFlowSpecRules],
  (rules) => rules.length
);

export const selectFlowSpecHasRules = createSelector(
  [selectFlowSpecRuleCount],
  (count) => count > 0
);

export const selectFlowSpecUIState = createSelector(
  [selectFlowSpecIsLoading, selectFlowSpecIsDeleting, selectFlowSpecIsCreating, selectFlowSpecError, selectFlowSpecSuccessMessage],
  (isLoading, isDeleting, isCreating, error, successMessage) => ({
    isWorking: isLoading || isDeleting || isCreating,
    hasError: !!error,
    errorMessage: error,
    successMessage
  })
);