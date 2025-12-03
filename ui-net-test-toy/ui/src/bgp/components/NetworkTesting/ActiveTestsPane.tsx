/**
 * Active Tests Pane Component
 * Displays currently running tests with expand/collapse details
 */

import React, { useState } from 'react';
import Card from '../../../_common/components/Card';
import { Button } from '../../../_common/components/ui';
import buttonCss from '../../../_common/styles/Button.module.css';

interface ActiveTest {
  test_id: string;
  tool: string;
  host?: string;
  params?: { host?: string };
  viewers: number;
  status: string;
  start?: string;
  hostPort?: string; // Added by flatMap
}

interface ActiveTestsPaneProps {
  activeTests: Record<string, ActiveTest[]>;
  viewingTestId?: string;
  onTestClick: (testId: string) => void;
  onStopTest?: (testId: string, hostPort: string) => void;
}

export const ActiveTestsPane: React.FC<ActiveTestsPaneProps> = ({
  activeTests,
  viewingTestId,
  onTestClick,
  onStopTest
}) => {
  const [expandedTests, setExpandedTests] = useState<Record<string, boolean>>({});

  // Keep track of hostPort for each test
  const runningTests = Object.entries(activeTests)
    .flatMap(([hostPort, tests]) =>
      tests
        .filter(t => t.status === 'running')
        .map(t => ({ ...t, hostPort }))
    );

  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>Running Tests</h2>
      <div style={{ fontSize: '0.875rem' }}>
        {runningTests.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No active tests
          </div>
        ) : (
          runningTests.map(test => (
            <div
              key={test.test_id}
              style={{
                padding: '0.75rem',
                marginBottom: '0.5rem',
                borderRadius: '4px',
                border: viewingTestId === test.test_id ? '2px solid var(--primary)' : '1px solid var(--border)',
                backgroundColor: viewingTestId === test.test_id ? 'var(--primary-bg)' : 'var(--card-bg)',
                cursor: 'pointer'
              }}
              onClick={() => {
                setExpandedTests(prev => ({ ...prev, [test.test_id]: !prev[test.test_id] }));
                onTestClick(test.test_id);
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem' }}>🟢</span>
                  <strong>{test.tool}</strong>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    → {test.host || test.params?.host || 'Unknown'}
                  </span>
                  {test.viewers > 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      ({test.viewers} viewer{test.viewers !== 1 ? 's' : ''})
                    </span>
                  )}
                </div>
                {onStopTest && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card click
                      onStopTest(test.test_id, test.hostPort);
                    }}
                    className={buttonCss.buttonDanger}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                  >
                    Stop
                  </Button>
                )}
              </div>

              {expandedTests[test.test_id] && (
                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{
                    display: 'flex',
                    gap: '1rem',
                    marginBottom: '0.5rem',
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary)'
                  }}>
                    <div>
                      <span style={{ fontWeight: 500 }}>ID:</span>{' '}
                      <span style={{ fontFamily: 'monospace', color: 'var(--text)' }}>
                        {test.test_id.substring(0, 8)}...
                      </span>
                    </div>
                    {test.start && (
                      <div>
                        <span style={{ fontWeight: 500 }}>Started:</span>{' '}
                        <span style={{ color: 'var(--text)' }}>
                          {new Date(test.start).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
