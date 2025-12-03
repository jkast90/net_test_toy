import { useState, useRef, useCallback, useEffect } from 'react';
import { useConfig, useContainerManagers } from '../contexts/ConfigContext';
import styles from './ContainerManagerSelector.module.css';

export default function ContainerManagerSelector() {
  const { selectedContainerManager } = useConfig();
  const { containerManagers, addContainerManager, updateContainerManager, removeContainerManager, selectContainerManager } = useContainerManagers();
  const [isOpen, setIsOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  // Clear the close timer
  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  // Start close timer when not hovering
  useEffect(() => {
    if (isOpen && !isHovering) {
      clearCloseTimer();
      closeTimerRef.current = setTimeout(() => {
        setIsOpen(false);
        setShowAddForm(false);
      }, 300);
    } else {
      clearCloseTimer();
    }

    return () => clearCloseTimer();
  }, [isOpen, isHovering, clearCloseTimer]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!newName.trim() || !newUrl.trim()) {
      setAddError('Name and URL are required');
      return;
    }

    const success = await addContainerManager(newName.trim(), newUrl.trim());

    if (success) {
      setNewName('');
      setNewUrl('');
      setShowAddForm(false);
      setIsOpen(false);
    } else {
      setAddError('Failed to add Container Manager. Please check the URL and try again.');
    }
  };

  const handleEdit = (e: React.MouseEvent, cm: { id: string; name: string; url: string }) => {
    e.stopPropagation();
    setEditingId(cm.id);
    setNewName(cm.name);
    setNewUrl(cm.url);
    setShowAddForm(false);
    setAddError(null);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!editingId) return;

    if (!newName.trim() || !newUrl.trim()) {
      setAddError('Name and URL are required');
      return;
    }

    const success = await updateContainerManager(editingId, newName.trim(), newUrl.trim());

    if (success) {
      setNewName('');
      setNewUrl('');
      setEditingId(null);
    } else {
      setAddError('Failed to update Container Manager. Please check the URL and try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setNewName('');
    setNewUrl('');
    setAddError(null);
  };

  const handleSelect = (id: string) => {
    selectContainerManager(id);
    setIsOpen(false);
    setIsHovering(false);
  };

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Remove this Container Manager?')) {
      removeContainerManager(id);
    }
  };

  return (
    <div className={styles.container}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        aria-label="Container Manager Selector"
      >
        <span className={styles.icon}>🔧</span>
        <span className={styles.label}>
          {selectedContainerManager ? selectedContainerManager.name : 'No Container Manager'}
        </span>
        <span className={styles.arrow}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div
          className={styles.dropdown}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <div className={styles.header}>
            <h3>Container Managers</h3>
            <button
              className={styles.closeBtn}
              onClick={() => {
                setIsOpen(false);
                setIsHovering(false);
              }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className={styles.list}>
            {containerManagers.length === 0 && (
              <div className={styles.empty}>No Container Managers configured</div>
            )}

            {containerManagers.map(cm => {
              if (editingId === cm.id) {
                // Show edit form for this item
                return (
                  <div key={cm.id} className={styles.editForm}>
                    <form onSubmit={handleUpdate}>
                      <input
                        type="text"
                        placeholder="Name (e.g., localhost)"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        className={styles.input}
                        autoFocus
                      />
                      <input
                        type="text"
                        placeholder="URL (e.g., http://localhost:5010)"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        className={styles.input}
                      />
                      {addError && <div className={styles.error}>{addError}</div>}
                      <div className={styles.formButtons}>
                        <button type="submit" className={styles.submitBtn}>
                          Save
                        </button>
                        <button
                          type="button"
                          className={styles.cancelBtn}
                          onClick={handleCancelEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                );
              }

              return (
                <div
                  key={cm.id}
                  className={`${styles.item} ${selectedContainerManager?.id === cm.id ? styles.active : ''}`}
                  onClick={() => handleSelect(cm.id)}
                >
                  <div className={styles.itemContent}>
                    <div className={styles.itemName}>{cm.name}</div>
                    <div className={styles.itemUrl}>{cm.url}</div>
                  </div>
                  <div className={styles.itemActions}>
                    <button
                      className={styles.editBtn}
                      onClick={(e) => handleEdit(e, cm)}
                      aria-label={`Edit ${cm.name}`}
                    >
                      ✎
                    </button>
                    <button
                      className={styles.removeBtn}
                      onClick={(e) => handleRemove(e, cm.id)}
                      aria-label={`Remove ${cm.name}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {!showAddForm ? (
            <button
              className={styles.addBtn}
              onClick={() => setShowAddForm(true)}
            >
              + Add Container Manager
            </button>
          ) : (
            <form className={styles.addForm} onSubmit={handleAdd}>
              <input
                type="text"
                placeholder="Name (e.g., localhost)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className={styles.input}
                autoFocus
              />
              <input
                type="text"
                placeholder="URL (e.g., http://localhost:5010)"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className={styles.input}
              />
              {addError && <div className={styles.error}>{addError}</div>}
              <div className={styles.formButtons}>
                <button type="submit" className={styles.submitBtn}>
                  Add
                </button>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => {
                    setShowAddForm(false);
                    setNewName('');
                    setNewUrl('');
                    setAddError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
