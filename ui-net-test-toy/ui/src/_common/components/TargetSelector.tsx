import React from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectAllClients, selectSelectedClientIds, selectEnabledDaemonsForSelectedClients } from '../store/connectionSelectors';
import { toggleSelectedClient, toggleDaemon, setSelectedClients } from '../store/connectionSlice';
import { DaemonConfig } from '../store/connectionSlice';
import styles from './TargetSelector.module.css';

interface TargetSelectorProps {
  label?: string;
  showDaemonFilter?: boolean;
}

export default function TargetSelector({ label = "Select Targets", showDaemonFilter = false }: TargetSelectorProps) {
  const dispatch = useAppDispatch();
  const allClients = useAppSelector(selectAllClients);
  const selectedClientIds = useAppSelector(selectSelectedClientIds);
  const selectedDaemons = useAppSelector(selectEnabledDaemonsForSelectedClients);

  const handleClientToggle = (clientId: string) => {
    dispatch(toggleSelectedClient(clientId));
  };

  const handleDaemonToggle = (clientId: string, daemonType: DaemonConfig['type']) => {
    dispatch(toggleDaemon({ clientId, daemonType }));
  };

  const handleSelectAll = () => {
    dispatch(setSelectedClients(allClients.map(c => c.id)));
  };

  const handleDeselectAll = () => {
    dispatch(setSelectedClients([]));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <label className={styles.label}>{label}</label>
        <div className={styles.actions}>
          <button onClick={handleSelectAll} className={styles.actionButton}>
            Select All
          </button>
          <button onClick={handleDeselectAll} className={styles.actionButton}>
            Deselect All
          </button>
        </div>
      </div>

      <div className={styles.clientList}>
        {allClients.map((client) => {
          const isSelected = selectedClientIds.includes(client.id);
          return (
            <div key={client.id} className={styles.clientItem}>
              <div className={styles.clientHeader}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleClientToggle(client.id)}
                    className={styles.checkbox}
                  />
                  <span className={styles.clientName}>
                    {client.name} ({client.baseUrl})
                  </span>
                </label>
              </div>

              {showDaemonFilter && isSelected && client.daemons && client.daemons.length > 0 && (
                <div className={styles.daemonList}>
                  {client.daemons.map((daemon) => (
                    <label key={daemon.type} className={styles.daemonLabel}>
                      <input
                        type="checkbox"
                        checked={daemon.enabled}
                        onChange={() => handleDaemonToggle(client.id, daemon.type)}
                        className={styles.checkbox}
                      />
                      <span className={styles.daemonName}>
                        {daemon.type.toUpperCase()}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {allClients.length === 0 && (
          <div className={styles.emptyState}>
            No API clients configured. Add clients in the Environment Manager.
          </div>
        )}
      </div>

      {selectedDaemons.length > 0 && (
        <div className={styles.summary}>
          Selected: {selectedDaemons.length} daemon{selectedDaemons.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
