import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button, ButtonGroup, DashboardPane, DashboardGrid } from './index';
import buttonCss from '../styles/Button.module.css';

export interface PaneConfig {
  id: string;
  title: string;
  category: string;
  component: React.ReactNode;
  actions?: React.ReactNode;
}

interface DashboardBuilderProps {
  availablePanes: PaneConfig[];
  selectedPanes: string[];
  onPanesChange: (panes: string[]) => void;
  paneOrder: string[];
  onOrderChange: (order: string[]) => void;
  previewColumns?: number;
  onColumnsChange?: (columns: number) => void;
  storageKey?: string; // Optional key for localStorage persistence
}

const DashboardBuilder: React.FC<DashboardBuilderProps> = ({
  availablePanes,
  selectedPanes,
  onPanesChange,
  paneOrder,
  onOrderChange,
  previewColumns = 3,
  onColumnsChange,
  storageKey
}) => {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [draggedPane, setDraggedPane] = useState<string | null>(null);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear the close timer
  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  // Start the close timer
  const startCloseTimer = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setOpenDropdown(null);
    }, 300);
  }, [clearCloseTimer]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  // Sync paneOrder with selectedPanes
  useEffect(() => {
    const newPanes = selectedPanes.filter(id => !paneOrder.includes(id));
    const updatedOrder = paneOrder.filter(id => selectedPanes.includes(id));

    if (newPanes.length > 0 || updatedOrder.length !== paneOrder.length) {
      const finalOrder = [...updatedOrder, ...newPanes];
      onOrderChange(finalOrder);
      if (storageKey) {
        localStorage.setItem(`${storageKey}-order`, JSON.stringify(finalOrder));
      }
    }
  }, [selectedPanes, paneOrder, onOrderChange, storageKey]);

  // Categories from available panes
  const categories = useMemo(() =>
    Array.from(new Set(availablePanes.map(p => p.category))),
    [availablePanes]
  );

  // Sort selected panes according to paneOrder
  const orderedSelectedPanes = useMemo(() => {
    const ordered = paneOrder.filter(id => selectedPanes.includes(id));
    const unordered = selectedPanes.filter(id => !paneOrder.includes(id));
    return [...ordered, ...unordered];
  }, [selectedPanes, paneOrder]);

  const selectAll = () => {
    const allIds = availablePanes.map(p => p.id);
    onPanesChange(allIds);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(allIds));
    }
  };

  const clearAll = () => {
    onPanesChange([]);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify([]));
    }
  };

  const handleDragStart = (e: React.DragEvent, paneId: string) => {
    setDraggedPane(paneId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetPaneId: string) => {
    e.preventDefault();

    if (!draggedPane || draggedPane === targetPaneId) {
      setDraggedPane(null);
      return;
    }

    const newOrder = [...orderedSelectedPanes];
    const draggedIndex = newOrder.indexOf(draggedPane);
    const targetIndex = newOrder.indexOf(targetPaneId);

    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedPane);

    onOrderChange(newOrder);
    if (storageKey) {
      localStorage.setItem(`${storageKey}-order`, JSON.stringify(newOrder));
    }
    setDraggedPane(null);
  };

  const handleDragEnd = () => {
    setDraggedPane(null);
  };

  return (
    <>
      {/* Pane Selection Panel */}
      <div style={{ marginBottom: '1.5rem', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '6px', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem', marginBottom: '0.25rem' }}>Available Panes</h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {selectedPanes.length} of {availablePanes.length} selected
            </div>
          </div>
          <ButtonGroup>
            <Button onClick={selectAll} className={buttonCss.buttonSecondary} style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>
              Select All
            </Button>
            <Button onClick={clearAll} className={buttonCss.buttonSecondary} style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}>
              Clear All
            </Button>
          </ButtonGroup>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '0.75rem'
        }}>
          {categories.map(category => {
            const categoryPanes = availablePanes.filter(pane => pane.category === category);
            const selectedInCategory = categoryPanes.filter(pane => selectedPanes.includes(pane.id));
            const isOpen = openDropdown === category;

            return (
              <div
                key={category}
                style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative' }}
                onMouseEnter={clearCloseTimer}
                onMouseLeave={startCloseTimer}
              >
                <label style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {category}
                </label>

                {/* Dropdown Button */}
                <button
                  onClick={() => {
                    clearCloseTimer();
                    setOpenDropdown(isOpen ? null : category);
                  }}
                  style={{
                    padding: '0.5rem 0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--card-bg)',
                    color: 'var(--text)',
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span>{selectedInCategory.length} / {categoryPanes.length} selected</span>
                  <span style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                </button>

                {/* Dropdown Menu */}
                {isOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '0.25rem',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    backgroundColor: 'var(--card-bg)',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    zIndex: 1000
                  }}>
                    {categoryPanes.map(pane => {
                      const isSelected = selectedPanes.includes(pane.id);
                      return (
                        <label
                          key={pane.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 0.75rem',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border)',
                            fontSize: '0.8125rem',
                            backgroundColor: isSelected ? 'var(--primary-bg, rgba(59, 130, 246, 0.1))' : 'transparent',
                            transition: 'background-color 0.15s'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              const newSelection = isSelected
                                ? selectedPanes.filter(id => id !== pane.id)
                                : [...selectedPanes, pane.id];
                              onPanesChange(newSelection);
                              if (storageKey) {
                                localStorage.setItem(storageKey, JSON.stringify(newSelection));
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          <span>{pane.title}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Dashboard Preview */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
            Dashboard Preview ({selectedPanes.length} panes)
          </h2>

          {onColumnsChange && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Columns:</label>
              <ButtonGroup>
                {[1, 2, 3, 4].map(cols => (
                  <Button
                    key={cols}
                    onClick={() => {
                      onColumnsChange(cols);
                      if (storageKey) {
                        localStorage.setItem(`${storageKey}-columns`, cols.toString());
                      }
                    }}
                    className={previewColumns === cols ? buttonCss.buttonPrimary : buttonCss.buttonSecondary}
                    style={{
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.875rem',
                      minWidth: '2.5rem'
                    }}
                  >
                    {cols}
                  </Button>
                ))}
              </ButtonGroup>
            </div>
          )}
        </div>

        {selectedPanes.length === 0 ? (
          <div style={{
            padding: '3rem',
            textAlign: 'center',
            backgroundColor: 'var(--card-bg)',
            border: '2px dashed var(--border)',
            borderRadius: '8px',
            color: 'var(--text-secondary)'
          }}>
            <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No panes selected</p>
            <p style={{ fontSize: '0.875rem' }}>Select panes above to build your custom dashboard</p>
          </div>
        ) : (
          <DashboardGrid columns={previewColumns}>
            {orderedSelectedPanes.map(paneId => {
              const pane = availablePanes.find(p => p.id === paneId);
              if (!pane) return null;

              return (
                <div
                  key={paneId}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, paneId)}
                >
                  <DashboardPane
                    title={pane.title}
                    actions={pane.actions}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, paneId)}
                    onDragEnd={handleDragEnd}
                    dragOpacity={draggedPane === paneId ? 0.5 : 1}
                  >
                    {pane.component}
                  </DashboardPane>
                </div>
              );
            })}
          </DashboardGrid>
        )}
      </div>
    </>
  );
};

export default DashboardBuilder;
