import { useCallback } from 'react';
import { useAsyncMutation, useMultiMutation } from './useAsyncMutation';
import { usePollingQuery } from './usePollingQuery';

/**
 * Service interface for CRUD operations
 */
export interface CRUDService<TItem, TCreateData = Partial<TItem>, TUpdateData = Partial<TItem>> {
  /** Fetch all items */
  getAll?: (clientUrl?: string) => Promise<TItem[]>;

  /** Get a single item by ID */
  getById?: (id: string, clientUrl?: string) => Promise<TItem>;

  /** Create a new item */
  create?: (data: TCreateData, clientUrl?: string) => Promise<TItem>;

  /** Update an existing item */
  update?: (id: string, data: TUpdateData, clientUrl?: string) => Promise<TItem>;

  /** Delete an item */
  delete?: (id: string, clientUrl?: string) => Promise<void>;
}

/**
 * Options for useCRUDOperations
 */
export interface UseCRUDOperationsOptions<TItem> {
  /**
   * Client URL to pass to service methods
   */
  clientUrl?: string;

  /**
   * Whether to enable automatic polling for getAll
   * @default true
   */
  enablePolling?: boolean;

  /**
   * Polling interval in milliseconds
   * @default 5000
   */
  pollingInterval?: number;

  /**
   * Whether to refetch after successful create
   * @default true
   */
  refetchOnCreate?: boolean;

  /**
   * Whether to refetch after successful update
   * @default true
   */
  refetchOnUpdate?: boolean;

  /**
   * Whether to refetch after successful delete
   * @default true
   */
  refetchOnDelete?: boolean;

  /**
   * Success message for create operation
   */
  createSuccessMessage?: string | ((item: TItem) => string);

  /**
   * Success message for update operation
   */
  updateSuccessMessage?: string | ((item: TItem) => string);

  /**
   * Success message for delete operation
   */
  deleteSuccessMessage?: string | (() => string);

  /**
   * Callback fired when any operation succeeds
   */
  onSuccess?: (operation: 'create' | 'update' | 'delete', item?: TItem) => void;

  /**
   * Callback fired when any operation fails
   */
  onError?: (operation: 'create' | 'update' | 'delete', error: Error) => void;

  /**
   * Callback fired after create succeeds
   */
  onCreateSuccess?: (item: TItem) => void;

  /**
   * Callback fired after update succeeds
   */
  onUpdateSuccess?: (item: TItem) => void;

  /**
   * Callback fired after delete succeeds
   */
  onDeleteSuccess?: () => void;
}

/**
 * Result returned by useCRUDOperations
 */
export interface UseCRUDOperationsResult<TItem, TCreateData, TUpdateData> {
  // Query state
  /** All items */
  items: TItem[] | null;

  /** Whether items are loading */
  isLoading: boolean;

  /** Error from fetching items */
  error: Error | null;

  /** Manually refetch items */
  refetch: () => Promise<void>;

  // Create operation
  /** Create mutation */
  create: {
    mutate: (data: TCreateData) => Promise<TItem | null>;
    isLoading: boolean;
    isSuccess: boolean;
    isError: boolean;
    error: Error | null;
    data: TItem | null;
    reset: () => void;
  };

  // Update operation
  /** Update mutation */
  update: {
    mutate: (id: string, data: TUpdateData) => Promise<TItem | null>;
    isLoading: boolean;
    isSuccess: boolean;
    isError: boolean;
    error: Error | null;
    data: TItem | null;
    reset: () => void;
  };

  // Delete operation
  /** Delete mutation */
  delete: {
    mutate: (id: string) => Promise<void | null>;
    isLoading: boolean;
    isSuccess: boolean;
    isError: boolean;
    error: Error | null;
    reset: () => void;
  };

  // Computed state
  /** Whether any mutation is loading */
  isAnyMutationLoading: boolean;

  /** Whether any mutation has an error */
  hasAnyMutationError: boolean;

  /** Reset all mutation states */
  resetMutations: () => void;
}

/**
 * Custom hook for standardized CRUD operations
 *
 * Combines polling query with create/update/delete mutations
 *
 * @example
 * ```typescript
 * const crud = useCRUDOperations(
 *   {
 *     getAll: () => api.getNeighbors(),
 *     create: (data) => api.createNeighbor(data),
 *     update: (id, data) => api.updateNeighbor(id, data),
 *     delete: (id) => api.deleteNeighbor(id)
 *   },
 *   {
 *     onCreateSuccess: () => {
 *       notifications.success('Neighbor created!');
 *       dialogs.createForm.close();
 *     }
 *   }
 * );
 *
 * // In component
 * {crud.isLoading && <Spinner />}
 * {crud.items?.map(item => <ItemCard key={item.id} item={item} />)}
 *
 * <button onClick={() => crud.create.mutate(formData)}>
 *   Create
 * </button>
 * ```
 */
export function useCRUDOperations<
  TItem,
  TCreateData = Partial<TItem>,
  TUpdateData = Partial<TItem>
>(
  service: CRUDService<TItem, TCreateData, TUpdateData>,
  options: UseCRUDOperationsOptions<TItem> = {}
): UseCRUDOperationsResult<TItem, TCreateData, TUpdateData> {
  const {
    clientUrl,
    enablePolling = true,
    pollingInterval = 5000,
    refetchOnCreate = true,
    refetchOnUpdate = true,
    refetchOnDelete = true,
    onSuccess,
    onError,
    onCreateSuccess,
    onUpdateSuccess,
    onDeleteSuccess
  } = options;

  // Query for all items
  const query = usePollingQuery(
    async () => {
      if (!service.getAll) {
        return [];
      }
      return service.getAll(clientUrl);
    },
    {
      interval: pollingInterval,
      enabled: enablePolling && !!service.getAll
    }
  );

  // Create mutation
  const createMutation = useAsyncMutation(
    async (data: TCreateData) => {
      if (!service.create) {
        throw new Error('Create operation not supported');
      }
      return service.create(data, clientUrl);
    },
    {
      onSuccess: async (item) => {
        onSuccess?.('create', item);
        onCreateSuccess?.(item);

        if (refetchOnCreate) {
          await query.refetch();
        }
      },
      onError: (error) => {
        onError?.('create', error);
      }
    }
  );

  // Update mutation
  const updateMutation = useAsyncMutation(
    async ({ id, data }: { id: string; data: TUpdateData }) => {
      if (!service.update) {
        throw new Error('Update operation not supported');
      }
      return service.update(id, data, clientUrl);
    },
    {
      onSuccess: async (item) => {
        onSuccess?.('update', item);
        onUpdateSuccess?.(item);

        if (refetchOnUpdate) {
          await query.refetch();
        }
      },
      onError: (error) => {
        onError?.('update', error);
      }
    }
  );

  // Delete mutation
  const deleteMutation = useAsyncMutation(
    async (id: string) => {
      if (!service.delete) {
        throw new Error('Delete operation not supported');
      }
      return service.delete(id, clientUrl);
    },
    {
      onSuccess: async () => {
        onSuccess?.('delete');
        onDeleteSuccess?.();

        if (refetchOnDelete) {
          await query.refetch();
        }
      },
      onError: (error) => {
        onError?.('delete', error);
      }
    }
  );

  // Wrap update.mutate to accept id and data separately
  const updateMutate = useCallback(
    async (id: string, data: TUpdateData) => {
      return updateMutation.mutate({ id, data });
    },
    [updateMutation]
  );

  const resetMutations = useCallback(() => {
    createMutation.reset();
    updateMutation.reset();
    deleteMutation.reset();
  }, [createMutation, updateMutation, deleteMutation]);

  return {
    // Query state
    items: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,

    // Create
    create: {
      mutate: createMutation.mutate,
      isLoading: createMutation.isLoading,
      isSuccess: createMutation.isSuccess,
      isError: createMutation.isError,
      error: createMutation.error,
      data: createMutation.data,
      reset: createMutation.reset
    },

    // Update
    update: {
      mutate: updateMutate,
      isLoading: updateMutation.isLoading,
      isSuccess: updateMutation.isSuccess,
      isError: updateMutation.isError,
      error: updateMutation.error,
      data: updateMutation.data,
      reset: updateMutation.reset
    },

    // Delete
    delete: {
      mutate: deleteMutation.mutate,
      isLoading: deleteMutation.isLoading,
      isSuccess: deleteMutation.isSuccess,
      isError: deleteMutation.isError,
      error: deleteMutation.error,
      reset: deleteMutation.reset
    },

    // Computed
    isAnyMutationLoading:
      createMutation.isLoading || updateMutation.isLoading || deleteMutation.isLoading,
    hasAnyMutationError:
      createMutation.isError || updateMutation.isError || deleteMutation.isError,
    resetMutations
  };
}

/**
 * Simplified CRUD hook without polling
 * Useful for modals or one-time operations
 *
 * @example
 * ```typescript
 * const crud = useSimpleCRUD({
 *   create: (data) => api.create(data),
 *   update: (id, data) => api.update(id, data),
 *   delete: (id) => api.delete(id)
 * });
 * ```
 */
export function useSimpleCRUD<
  TItem,
  TCreateData = Partial<TItem>,
  TUpdateData = Partial<TItem>
>(
  service: Omit<CRUDService<TItem, TCreateData, TUpdateData>, 'getAll' | 'getById'>,
  options: Omit<UseCRUDOperationsOptions<TItem>, 'enablePolling' | 'pollingInterval'> = {}
): Omit<UseCRUDOperationsResult<TItem, TCreateData, TUpdateData>, 'items' | 'isLoading' | 'error' | 'refetch'> {
  const result = useCRUDOperations(
    { ...service, getAll: undefined },
    { ...options, enablePolling: false }
  );

  return {
    create: result.create,
    update: result.update,
    delete: result.delete,
    isAnyMutationLoading: result.isAnyMutationLoading,
    hasAnyMutationError: result.hasAnyMutationError,
    resetMutations: result.resetMutations
  };
}
