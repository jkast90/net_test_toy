/**
 * Custom Hooks
 *
 * Collection of reusable React hooks for common patterns
 */

// Async operations
export {
  useAsyncMutation,
  useSimpleAsyncMutation,
  useMultiMutation,
  type UseAsyncMutationOptions,
  type UseAsyncMutationResult
} from './useAsyncMutation';

// CRUD operations
export {
  useCRUDOperations,
  useSimpleCRUD,
  type CRUDService,
  type UseCRUDOperationsOptions,
  type UseCRUDOperationsResult
} from './useCRUDOperations';

// Dialog management
export {
  useDialogManager,
  useSimpleDialogManager,
  useDialogWithData,
  type DialogConfig,
  type DialogState,
  type UseDialogManagerResult
} from './useDialogManager';

// Polling queries
export {
  usePollingQuery,
  usePollingQueryWithDeps,
  type UsePollingQueryOptions,
  type UsePollingQueryResult
} from './usePollingQuery';

// Operation feedback
export {
  useOperationWithFeedback,
  type OperationFeedback,
  type UseOperationWithFeedbackResult
} from './useOperationWithFeedback';

// Alert/message management
export {
  useAlert,
  type AlertType,
  type AlertState
} from './useAlert';

// Toast notifications
export {
  useToast,
  type ShowToastOptions
} from './useToast';

// Feedback toast (combines useToast with automatic feedback display)
export {
  useFeedbackToast,
  type Feedback,
  type UseFeedbackToastOptions,
  type FeedbackToastState
} from './useFeedbackToast';

// Dashboard layout state management
export {
  useDashboardLayout,
  type UseDashboardLayoutOptions,
  type DashboardLayoutState
} from './useDashboardLayout';

// Async form state (loading/error/success patterns)
export {
  useAsyncFormState,
  type AsyncFormState,
  type UseAsyncFormStateReturn
} from './useAsyncFormState';

// Clipboard operations
export {
  useClipboard,
  type UseClipboardOptions,
  type UseClipboardReturn
} from './useClipboard';

// Existing hooks (re-exported for convenience)
export { useAppDispatch, useAppSelector } from '../store/hooks';
export { useFlowSpec } from './useFlowSpec';
export { useFlowSpecOperationsWithFeedback } from './useFlowSpecOperationsWithFeedback';
export { useLabManager, useLabManagerOperations } from './useLabManager';
export { useLabManagerOperationsWithFeedback } from './useLabManagerOperationsWithFeedback';
export { useConnectionManagerOperations } from './useConnectionManagerOperations';
export { useNetworkTesting } from './useNetworkTesting';
export { useNetworkTestingParams } from './useNetworkTestingParams';
export { useTopologyManager } from './useTopologyManager';
export { useDockerNetworks } from './useDockerNetworks';
export { useGreTunnels } from './useGreTunnels';

// NetFlow hooks
export { useNetFlowConfig } from './useNetFlow';

// Neighbor hooks
export { useNeighbors, useGroupedNeighbors, useNeighborOperations, useFilteredNeighbors, useSortedNeighbors } from './useNeighbors';
export { useNeighborOperationsWithFeedback } from './useNeighborOperationsWithFeedback';

// Route hooks
export { useRoutes } from './useRoutes';
export { useRouteOperations } from './useRouteOperations';

// Trigger hooks
export { useTriggerOperations } from './useTriggerOperations';
export { useTriggerEvaluation } from './useTriggerEvaluation';

// Docker Network operations
export { useDockerNetworkOperations, type NetworkCreateParams, type CreateNetworkOptions, type DeleteNetworkOptions, type UseDockerNetworkOperationsOptions } from './useDockerNetworkOperations';
