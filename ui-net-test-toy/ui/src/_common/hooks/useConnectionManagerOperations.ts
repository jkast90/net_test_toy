/**
 * Connection Manager Operations Hook
 * Manages BGP client connections with form state and dialog coordination
 */

import { useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectAllClients } from '../store/connectionSelectors';
import {
  addClient,
  updateClient,
  removeClient
} from '../store/connectionSlice';

interface ConnectionFormState {
  showAddForm: boolean;
  editingClientId: string | null;
  name: string;
  url: string;
  pollInterval: number;
}

export const useConnectionManagerOperations = () => {
  const dispatch = useAppDispatch();
  const clients = useAppSelector(selectAllClients);

  // Form state
  const [formState, setFormState] = useState<ConnectionFormState>({
    showAddForm: false,
    editingClientId: null,
    name: '',
    url: '',
    pollInterval: 5
  });

  // Open form for adding new connection
  const openAddForm = useCallback(() => {
    setFormState({
      showAddForm: true,
      editingClientId: null,
      name: '',
      url: '',
      pollInterval: 5
    });
  }, []);

  // Open form for editing existing connection
  const openEditForm = useCallback((clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setFormState({
        showAddForm: true,
        editingClientId: clientId,
        name: client.name,
        url: client.baseUrl,
        pollInterval: client.pollInterval
      });
    }
  }, [clients]);

  // Close form and reset
  const closeForm = useCallback(() => {
    setFormState({
      showAddForm: false,
      editingClientId: null,
      name: '',
      url: '',
      pollInterval: 5
    });
  }, []);

  // Update form field
  const updateFormField = useCallback(<K extends keyof ConnectionFormState>(
    field: K,
    value: ConnectionFormState[K]
  ) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  }, []);

  // Submit form (add or update)
  const submitConnection = useCallback(() => {
    if (formState.editingClientId) {
      dispatch(updateClient({
        id: formState.editingClientId,
        name: formState.name,
        baseUrl: formState.url,
        pollInterval: formState.pollInterval
      }));
    } else {
      dispatch(addClient({
        name: formState.name,
        baseUrl: formState.url,
        daemons: [
          { type: 'gobgp', enabled: true },
          { type: 'frr', enabled: false },
          { type: 'exabgp', enabled: false },
          { type: 'bmp', enabled: false, port: 5002 },
          { type: 'netflow', enabled: false, port: 5003 }
        ],
        pollInterval: formState.pollInterval,
        enabled: true
      }));
    }

    closeForm();
  }, [formState, dispatch, closeForm]);

  // Delete connection
  const deleteConnection = useCallback((clientId: string) => {
    dispatch(removeClient(clientId));
  }, [dispatch]);

  return {
    // Form state
    formState,

    // Form actions
    openAddForm,
    openEditForm,
    closeForm,
    updateFormField,
    submitConnection,

    // Delete action
    deleteConnection
  };
};
