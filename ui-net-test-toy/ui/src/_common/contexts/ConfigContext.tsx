import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { configService, AppConfig } from '../services/configService';

export interface ContainerManager {
  id: string;
  name: string;
  url: string;
}

interface ConfigContextType {
  config: AppConfig | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;

  // Container Manager management
  containerManagers: ContainerManager[];
  selectedContainerManagerId: string | null;
  selectedContainerManager: ContainerManager | null;
  addContainerManager: (name: string, url: string) => Promise<boolean>;
  updateContainerManager: (id: string, name: string, url: string) => Promise<boolean>;
  removeContainerManager: (id: string) => void;
  selectContainerManager: (id: string) => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

const STORAGE_KEY_CONTAINER_MANAGERS = 'netstream_container_managers';
const STORAGE_KEY_SELECTED_MANAGER = 'netstream_selected_container_manager';

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Container Manager management state
  const [containerManagers, setContainerManagers] = useState<ContainerManager[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_CONTAINER_MANAGERS);
    return stored ? JSON.parse(stored) : [];
  });

  const [selectedContainerManagerId, setSelectedContainerManagerId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY_SELECTED_MANAGER);
  });

  const selectedContainerManager = containerManagers.find(cm => cm.id === selectedContainerManagerId) || null;

  // Persist container managers to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CONTAINER_MANAGERS, JSON.stringify(containerManagers));
  }, [containerManagers]);

  // Persist selected container manager to localStorage
  useEffect(() => {
    if (selectedContainerManagerId) {
      localStorage.setItem(STORAGE_KEY_SELECTED_MANAGER, selectedContainerManagerId);
    } else {
      localStorage.removeItem(STORAGE_KEY_SELECTED_MANAGER);
    }
  }, [selectedContainerManagerId]);

  // Add a new Container Manager
  const addContainerManager = useCallback(async (name: string, url: string): Promise<boolean> => {
    // Validate the URL by probing it
    const isValid = await configService.probeContainerManager(url);
    if (!isValid) {
      console.error(`Failed to add Container Manager: ${url} is not a valid Container Manager`);
      return false;
    }

    // Create new Container Manager
    const newManager: ContainerManager = {
      id: `cm-${Date.now()}`,
      name,
      url: url.replace(/\/$/, '') // Remove trailing slash
    };

    // Add to list
    setContainerManagers(prev => [...prev, newManager]);

    // If this is the first one, select it automatically
    if (containerManagers.length === 0) {
      setSelectedContainerManagerId(newManager.id);
    }

    return true;
  }, [containerManagers.length]);

  // Update a Container Manager
  const updateContainerManager = useCallback(async (id: string, name: string, url: string): Promise<boolean> => {
    // Validate the URL by probing it
    const isValid = await configService.probeContainerManager(url);
    if (!isValid) {
      console.error(`Failed to update Container Manager: ${url} is not a valid Container Manager`);
      return false;
    }

    // Update the manager
    setContainerManagers(prev => prev.map(cm =>
      cm.id === id
        ? { ...cm, name, url: url.replace(/\/$/, '') }
        : cm
    ));

    // If this was the selected manager, update the base URL
    if (selectedContainerManagerId === id) {
      configService.setBaseUrl(url.replace(/\/$/, ''));
    }

    return true;
  }, [selectedContainerManagerId]);

  // Remove a Container Manager
  const removeContainerManager = useCallback((id: string) => {
    setContainerManagers(prev => prev.filter(cm => cm.id !== id));

    // If we removed the selected one, select the first available or null
    if (selectedContainerManagerId === id) {
      const remaining = containerManagers.filter(cm => cm.id !== id);
      setSelectedContainerManagerId(remaining.length > 0 ? remaining[0].id : null);
    }
  }, [containerManagers, selectedContainerManagerId]);

  // Select a Container Manager
  const selectContainerManager = useCallback((id: string) => {
    const manager = containerManagers.find(cm => cm.id === id);
    if (manager) {
      setSelectedContainerManagerId(id);
      configService.setBaseUrl(manager.url);
    }
  }, [containerManagers]);

  const fetchConfig = async (suppressLogs = false) => {
    try {
      setLoading(true);
      setError(null);

      // If we have a selected Container Manager, use it
      if (selectedContainerManager) {
        configService.setBaseUrl(selectedContainerManager.url);
      } else {
        // Auto-detect container manager on localhost:5010
        const detected = await configService.autoDetectContainerManager();
        if (detected) {
          // Add the auto-detected Container Manager to the list
          await addContainerManager('localhost', 'http://localhost:5010');
        } else {
          throw new Error('No container manager configured. Please add a Container Manager.');
        }
      }

      // Use the config service to fetch configuration
      const data = await configService.fetchConfig(suppressLogs);

      // Validate the configuration
      if (configService.validateConfig(data)) {
        setConfig(data);
      } else {
        throw new Error('Invalid configuration received');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Failed to fetch config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();

    // Refetch every 30 seconds to pick up new daemons/hosts
    const interval = setInterval(() => fetchConfig(true), 30000); // Suppress logs for polling
    return () => clearInterval(interval);
  }, [selectedContainerManagerId]); // Re-fetch when selected Container Manager changes

  return (
    <ConfigContext.Provider
      value={{
        config,
        loading,
        error,
        refetch: fetchConfig,
        containerManagers,
        selectedContainerManagerId,
        selectedContainerManager,
        addContainerManager,
        updateContainerManager,
        removeContainerManager,
        selectContainerManager
      }}
    >
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}

// Convenience hooks
export function useContainerManager() {
  const { selectedContainerManager } = useConfig();
  // Return the selected Container Manager object which has { id, name, url }
  return selectedContainerManager;
}

export function useContainerManagers() {
  const { containerManagers, addContainerManager, updateContainerManager, removeContainerManager, selectContainerManager } = useConfig();
  return { containerManagers, addContainerManager, updateContainerManager, removeContainerManager, selectContainerManager };
}

export function useMonitoring() {
  const { config } = useConfig();
  return config?.monitoring;
}

export function useDaemons() {
  const { config } = useConfig();
  return config?.daemons || [];
}

export function useDaemon(name: string) {
  const daemons = useDaemons();
  return daemons.find(d => d.name === name);
}

export function useHosts() {
  const { config } = useConfig();
  return config?.hosts || [];
}

export function useHost(name: string) {
  const hosts = useHosts();
  return hosts.find(h => h.name === name);
}
