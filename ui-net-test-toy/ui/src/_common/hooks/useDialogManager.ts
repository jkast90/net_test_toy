import { useState, useCallback, useMemo } from 'react';

/**
 * Configuration for a single dialog
 */
export interface DialogConfig {
  /** Initial open state */
  initialOpen?: boolean;

  /** Callback fired when dialog opens */
  onOpen?: () => void;

  /** Callback fired when dialog closes */
  onClose?: () => void;

  /** Data associated with this dialog (e.g., editing item) */
  data?: any;
}

/**
 * State and controls for a single dialog
 */
export interface DialogState {
  /** Whether the dialog is open */
  isOpen: boolean;

  /** Open the dialog */
  open: (data?: any) => void;

  /** Close the dialog */
  close: () => void;

  /** Toggle the dialog */
  toggle: () => void;

  /** Data associated with this dialog */
  data: any;

  /** Set dialog data without opening */
  setData: (data: any) => void;
}

/**
 * Result returned by useDialogManager
 */
export interface UseDialogManagerResult {
  /** Object containing all dialog states keyed by dialog name */
  dialogs: Record<string, DialogState>;

  /** Open a specific dialog */
  open: (dialogName: string, data?: any) => void;

  /** Close a specific dialog */
  close: (dialogName: string) => void;

  /** Toggle a specific dialog */
  toggle: (dialogName: string) => void;

  /** Close all dialogs */
  closeAll: () => void;

  /** Check if any dialog is open */
  isAnyOpen: boolean;

  /** Get list of all open dialog names */
  openDialogs: string[];
}

/**
 * Custom hook for managing multiple dialog states
 *
 * Eliminates the need for multiple useState declarations for dialogs
 *
 * @example
 * ```typescript
 * // Before:
 * const [showCreateForm, setShowCreateForm] = useState(false);
 * const [showEditForm, setShowEditForm] = useState(false);
 * const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
 *
 * // After:
 * const { dialogs } = useDialogManager({
 *   createForm: {},
 *   editForm: {},
 *   deleteConfirm: {}
 * });
 *
 * // Usage:
 * <button onClick={() => dialogs.createForm.open()}>Create</button>
 * <Modal isOpen={dialogs.createForm.isOpen} onClose={dialogs.createForm.close}>
 *   ...
 * </Modal>
 *
 * // With data:
 * dialogs.editForm.open({ id: '123', name: 'Item' });
 * console.log(dialogs.editForm.data); // { id: '123', name: 'Item' }
 * ```
 */
export function useDialogManager(
  dialogConfigs: Record<string, DialogConfig> = {}
): UseDialogManagerResult {
  // Internal state: { dialogName: { isOpen: boolean, data: any } }
  const [dialogStates, setDialogStates] = useState<
    Record<string, { isOpen: boolean; data: any }>
  >(() => {
    const initial: Record<string, { isOpen: boolean; data: any }> = {};

    Object.entries(dialogConfigs).forEach(([name, config]) => {
      initial[name] = {
        isOpen: config.initialOpen || false,
        data: config.data || null
      };
    });

    return initial;
  });

  // Open a dialog
  const open = useCallback((dialogName: string, data?: any) => {
    setDialogStates(prev => ({
      ...prev,
      [dialogName]: {
        isOpen: true,
        data: data !== undefined ? data : prev[dialogName]?.data || null
      }
    }));

    // Call onOpen callback if provided
    dialogConfigs[dialogName]?.onOpen?.();
  }, [dialogConfigs]);

  // Close a dialog
  const close = useCallback((dialogName: string) => {
    setDialogStates(prev => ({
      ...prev,
      [dialogName]: {
        ...prev[dialogName],
        isOpen: false
      }
    }));

    // Call onClose callback if provided
    dialogConfigs[dialogName]?.onClose?.();
  }, [dialogConfigs]);

  // Toggle a dialog
  const toggle = useCallback((dialogName: string) => {
    setDialogStates(prev => {
      const currentState = prev[dialogName];
      const willBeOpen = !currentState?.isOpen;

      // Call appropriate callback
      if (willBeOpen) {
        dialogConfigs[dialogName]?.onOpen?.();
      } else {
        dialogConfigs[dialogName]?.onClose?.();
      }

      return {
        ...prev,
        [dialogName]: {
          ...currentState,
          isOpen: willBeOpen
        }
      };
    });
  }, [dialogConfigs]);

  // Set dialog data without opening
  const setData = useCallback((dialogName: string, data: any) => {
    setDialogStates(prev => ({
      ...prev,
      [dialogName]: {
        ...prev[dialogName],
        data
      }
    }));
  }, []);

  // Close all dialogs
  const closeAll = useCallback(() => {
    setDialogStates(prev => {
      const newState: Record<string, { isOpen: boolean; data: any }> = {};

      Object.entries(prev).forEach(([name, state]) => {
        newState[name] = {
          ...state,
          isOpen: false
        };

        // Call onClose callbacks
        if (state.isOpen) {
          dialogConfigs[name]?.onClose?.();
        }
      });

      return newState;
    });
  }, [dialogConfigs]);

  // Create dialog state objects
  const dialogs = useMemo(() => {
    const result: Record<string, DialogState> = {};

    Object.entries(dialogConfigs).forEach(([name]) => {
      const state = dialogStates[name] || { isOpen: false, data: null };

      result[name] = {
        isOpen: state.isOpen,
        data: state.data,
        open: (data?: any) => open(name, data),
        close: () => close(name),
        toggle: () => toggle(name),
        setData: (data: any) => setData(name, data)
      };
    });

    return result;
  }, [dialogStates, dialogConfigs, open, close, toggle, setData]);

  // Calculate derived state
  const openDialogs = useMemo(() => {
    return Object.entries(dialogStates)
      .filter(([_, state]) => state.isOpen)
      .map(([name]) => name);
  }, [dialogStates]);

  const isAnyOpen = openDialogs.length > 0;

  return {
    dialogs,
    open,
    close,
    toggle,
    closeAll,
    isAnyOpen,
    openDialogs
  };
}

/**
 * Simplified variant that only needs dialog names (no config)
 *
 * @example
 * ```typescript
 * const { dialogs } = useSimpleDialogManager([
 *   'createForm',
 *   'editForm',
 *   'deleteConfirm'
 * ]);
 *
 * <button onClick={dialogs.createForm.open}>Create</button>
 * ```
 */
export function useSimpleDialogManager(dialogNames: string[]): UseDialogManagerResult {
  const config = useMemo(() => {
    const result: Record<string, DialogConfig> = {};
    dialogNames.forEach(name => {
      result[name] = {};
    });
    return result;
  }, [dialogNames]);

  return useDialogManager(config);
}

/**
 * Hook for managing a single dialog with data
 * Useful for edit/view dialogs where you need to pass an item
 *
 * @example
 * ```typescript
 * const editDialog = useDialogWithData<User>();
 *
 * // Open with data
 * editDialog.open(user);
 *
 * // In modal
 * <Modal isOpen={editDialog.isOpen} onClose={editDialog.close}>
 *   {editDialog.data && <EditForm user={editDialog.data} />}
 * </Modal>
 * ```
 */
export function useDialogWithData<T = any>() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<T | null>(null);

  const open = useCallback((newData?: T) => {
    if (newData !== undefined) {
      setData(newData);
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const updateData = useCallback((newData: T) => {
    setData(newData);
  }, []);

  const reset = useCallback(() => {
    setIsOpen(false);
    setData(null);
  }, []);

  return {
    isOpen,
    data,
    open,
    close,
    toggle,
    setData: updateData,
    reset
  };
}
