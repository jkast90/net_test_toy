import { createAsyncThunk } from '@reduxjs/toolkit';
import { labManagerService } from './labManagerService';
import type { LabDaemon, LabHost, ExecCommandResult } from './labManagerService';
import { fetchSingleHostData } from '../../store/labManagerSlice';

/**
 * Async thunks for Lab Manager mutation operations
 * Following the pattern established by netflow and bmp services
 */

// Daemon mutations
export const createDaemon = createAsyncThunk<
  LabDaemon,
  {
    hostId: string;
    config: {
      name: string;
      daemon_type: 'gobgp' | 'frr' | 'exabgp';
      asn?: string;
      router_id?: string;
    };
  },
  { rejectValue: string }
>(
  'labManager/createDaemon',
  async ({ hostId, config }, { getState, dispatch, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const host = state.labManager.managedHosts.find((h: any) => h.id === hostId);

      if (!host || !host.url) {
        return rejectWithValue('Host not found or invalid URL');
      }

      const daemon = await labManagerService.createDaemon(host.url, config);

      // Refetch data for this host
      dispatch(fetchSingleHostData(hostId));

      return daemon;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create daemon';
      return rejectWithValue(message);
    }
  }
);

export const updateDaemon = createAsyncThunk<
  LabDaemon,
  {
    hostId: string;
    daemonId: string;
    config: Partial<LabDaemon>;
  },
  { rejectValue: string }
>(
  'labManager/updateDaemon',
  async ({ hostId, daemonId, config }, { getState, dispatch, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const host = state.labManager.managedHosts.find((h: any) => h.id === hostId);

      if (!host || !host.url) {
        return rejectWithValue('Host not found or invalid URL');
      }

      const daemon = await labManagerService.updateDaemon(host.url, daemonId, config);

      // Refetch data for this host
      dispatch(fetchSingleHostData(hostId));

      return daemon;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update daemon';
      return rejectWithValue(message);
    }
  }
);

export const deleteDaemon = createAsyncThunk<
  string,
  {
    hostId: string;
    daemonId: string;
  },
  { rejectValue: string }
>(
  'labManager/deleteDaemon',
  async ({ hostId, daemonId }, { getState, dispatch, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const host = state.labManager.managedHosts.find((h: any) => h.id === hostId);

      if (!host || !host.url) {
        return rejectWithValue('Host not found or invalid URL');
      }

      await labManagerService.deleteDaemon(host.url, daemonId);

      // Refetch data for this host
      dispatch(fetchSingleHostData(hostId));

      return daemonId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete daemon';
      return rejectWithValue(message);
    }
  }
);

// Host mutations
export const createLabHost = createAsyncThunk<
  LabHost,
  {
    hostId: string;
    config: {
      name: string;
      gateway_daemon?: string;
      loopback_network?: string;
    };
  },
  { rejectValue: string }
>(
  'labManager/createLabHost',
  async ({ hostId, config }, { getState, dispatch, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const host = state.labManager.managedHosts.find((h: any) => h.id === hostId);

      if (!host || !host.url) {
        return rejectWithValue('Host not found or invalid URL');
      }

      const labHost = await labManagerService.createHost(host.url, config);

      // Refetch data for this host
      dispatch(fetchSingleHostData(hostId));

      return labHost;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create host';
      return rejectWithValue(message);
    }
  }
);

export const deleteLabHost = createAsyncThunk<
  string,
  {
    hostId: string;
    labHostId: string;
  },
  { rejectValue: string }
>(
  'labManager/deleteLabHost',
  async ({ hostId, labHostId }, { getState, dispatch, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const host = state.labManager.managedHosts.find((h: any) => h.id === hostId);

      if (!host || !host.url) {
        return rejectWithValue('Host not found or invalid URL');
      }

      await labManagerService.deleteHost(host.url, labHostId);

      // Refetch data for this host
      dispatch(fetchSingleHostData(hostId));

      return labHostId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete host';
      return rejectWithValue(message);
    }
  }
);

// Other operations
export const execCommand = createAsyncThunk<
  ExecCommandResult,
  {
    hostId: string;
    containerId: string;
    command: string;
  },
  { rejectValue: string }
>(
  'labManager/execCommand',
  async ({ hostId, containerId, command }, { getState, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const host = state.labManager.managedHosts.find((h: any) => h.id === hostId);

      if (!host || !host.url) {
        return rejectWithValue('Host not found or invalid URL');
      }

      return await labManagerService.execCommand(host.url, containerId, command);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to exec command';
      return rejectWithValue(message);
    }
  }
);

export const associateNetwork = createAsyncThunk<
  void,
  {
    hostId: string;
    containerId: string;
    networkName: string;
  },
  { rejectValue: string }
>(
  'labManager/associateNetwork',
  async ({ hostId, containerId, networkName }, { getState, dispatch, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const host = state.labManager.managedHosts.find((h: any) => h.id === hostId);

      if (!host || !host.url) {
        return rejectWithValue('Host not found or invalid URL');
      }

      await labManagerService.associateNetwork(host.url, containerId, networkName);

      // Refetch data for this host
      dispatch(fetchSingleHostData(hostId));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to associate network';
      return rejectWithValue(message);
    }
  }
);

export const restoreLab = createAsyncThunk<
  void,
  {
    hostId: string;
  },
  { rejectValue: string }
>(
  'labManager/restoreLab',
  async ({ hostId }, { getState, dispatch, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const host = state.labManager.managedHosts.find((h: any) => h.id === hostId);

      if (!host || !host.url) {
        return rejectWithValue('Host not found or invalid URL');
      }

      await labManagerService.restoreLab(host.url);

      // Refetch data for this host
      dispatch(fetchSingleHostData(hostId));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to restore lab';
      return rejectWithValue(message);
    }
  }
);
