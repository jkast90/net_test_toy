/**
 * Test Configuration Pane Component
 * Main form for configuring and running network tests
 */

import React from 'react';
import Card from '../../../_common/components/Card';
import { Button, SelectField, Alert } from '../../../_common/components/ui';
import { BaseDialog } from '../../../_common/components/ui';
import {
  PingParametersForm,
  TracerouteParametersForm,
  IperfParametersForm,
  HpingParametersForm,
  CurlParametersForm
} from './index';
import styles from '../../pages/NetworkTesting.module.css';
import { getAllIPs } from '../../../_common/utils/networkUtils';

interface TestConfigurationPaneProps {
  // Selection state
  selectedSourceIP: string;
  selectedTargetIP: string;
  selectedSourceHost: string;
  selectedTool: string;

  // Tool parameters
  pingParams: any;
  traceParams: any;
  iperfParams: any;
  hpingParams: any;
  curlParams: any;

  // Tool parameter setters
  setPingParams: (params: any) => void;
  setTraceParams: (params: any) => void;
  setIperfParams: (params: any) => void;
  setHpingParams: (params: any) => void;
  setCurlParams: (params: any) => void;

  // Actions
  onSourceIPChange: (ip: string) => void;
  onTargetIPChange: (ip: string) => void;
  onToolChange: (tool: string) => void;
  onRunTest: () => void;
  onStopTest: () => void;
  onPresetApply: (preset: string) => void;

  // Data
  labHosts: any[];
  isRunning: boolean;
  isConfigured: boolean;
  error?: string;
}

export const TestConfigurationPane: React.FC<TestConfigurationPaneProps> = ({
  selectedSourceIP,
  selectedTargetIP,
  selectedSourceHost,
  selectedTool,
  pingParams,
  traceParams,
  iperfParams,
  hpingParams,
  curlParams,
  setPingParams,
  setTraceParams,
  setIperfParams,
  setHpingParams,
  setCurlParams,
  onSourceIPChange,
  onTargetIPChange,
  onToolChange,
  onRunTest,
  onStopTest,
  onPresetApply,
  labHosts,
  isRunning,
  isConfigured,
  error
}) => {
  return (
    <Card>
      <h2 style={{ marginTop: 0 }}>Test Configuration</h2>

      {/* Source and Target Selection */}
      <div className={styles.formGrid2}>
        <SelectField
          label="Source IP"
          value={selectedSourceIP}
          onChange={(e) => onSourceIPChange(e.target.value)}
          options={labHosts.flatMap(host =>
            getAllIPs(host).map(({ ip, label }) => ({
              value: ip,
              label: `${host.name} - ${label}`
            }))
          )}
        />

        <SelectField
          label="Target IP"
          value={selectedTargetIP}
          onChange={(e) => onTargetIPChange(e.target.value)}
          options={labHosts
            .filter(host => host.name !== selectedSourceHost)
            .flatMap(host =>
              getAllIPs(host).map(({ ip, label }) => ({
                value: ip,
                label: `${host.name} - ${label}`
              }))
            )}
        />
      </div>

      {/* Tool Selection */}
      <SelectField
        label="Tool"
        value={selectedTool}
        onChange={(e) => onToolChange(e.target.value)}
        options={[
          { value: 'ping', label: 'Ping - ICMP echo test' },
          { value: 'traceroute', label: 'Traceroute - Path discovery' },
          { value: 'iperf', label: 'iPerf - Bandwidth test' },
          { value: 'hping', label: 'hping - Advanced packet crafting' },
          { value: 'curl', label: 'cURL - HTTP traffic generator' }
        ]}
      />

      {/* Tool-specific parameters */}
      {selectedTool === 'ping' && (
        <PingParametersForm
          count={pingParams.count}
          interval={pingParams.interval}
          size={pingParams.size}
          flood={pingParams.flood}
          verbose={pingParams.verbose}
          onCountChange={(count) => setPingParams((prev: any) => ({ ...prev, count }))}
          onIntervalChange={(interval) => setPingParams((prev: any) => ({ ...prev, interval }))}
          onSizeChange={(size) => setPingParams((prev: any) => ({ ...prev, size }))}
          onFloodChange={(flood) => setPingParams((prev: any) => ({ ...prev, flood }))}
          onVerboseChange={(verbose) => setPingParams((prev: any) => ({ ...prev, verbose }))}
        />
      )}

      {selectedTool === 'traceroute' && (
        <TracerouteParametersForm
          maxHops={traceParams.maxHops}
          onMaxHopsChange={(maxHops) => setTraceParams((prev: any) => ({ ...prev, maxHops }))}
        />
      )}

      {selectedTool === 'iperf' && (
        <IperfParametersForm
          duration={iperfParams.duration}
          protocol={iperfParams.protocol}
          port={iperfParams.port}
          onDurationChange={(duration) => setIperfParams((prev: any) => ({ ...prev, duration }))}
          onProtocolChange={(protocol) => setIperfParams((prev: any) => ({ ...prev, protocol }))}
          onPortChange={(port) => setIperfParams((prev: any) => ({ ...prev, port }))}
        />
      )}

      {selectedTool === 'hping' && (
        <HpingParametersForm
          protocol={hpingParams.protocol}
          count={hpingParams.count}
          flood={hpingParams.flood}
          verbose={hpingParams.verbose}
          frag={hpingParams.frag}
          syn={hpingParams.syn}
          ttl={hpingParams.ttl}
          interval={hpingParams.interval}
          data={hpingParams.data}
          randSource={hpingParams.randSource}
          sourcePort={hpingParams.sourcePort}
          destPort={hpingParams.destPort}
          firewallId={hpingParams.firewallId}
          preset={hpingParams.preset}
          onProtocolChange={(protocol) => setHpingParams((prev: any) => ({ ...prev, protocol }))}
          onCountChange={(count) => setHpingParams((prev: any) => ({ ...prev, count }))}
          onFloodChange={(flood) => setHpingParams((prev: any) => ({ ...prev, flood }))}
          onVerboseChange={(verbose) => setHpingParams((prev: any) => ({ ...prev, verbose }))}
          onFragChange={(frag) => setHpingParams((prev: any) => ({ ...prev, frag }))}
          onSynChange={(syn) => setHpingParams((prev: any) => ({ ...prev, syn }))}
          onTtlChange={(ttl) => setHpingParams((prev: any) => ({ ...prev, ttl }))}
          onIntervalChange={(interval) => setHpingParams((prev: any) => ({ ...prev, interval }))}
          onDataChange={(data) => setHpingParams((prev: any) => ({ ...prev, data }))}
          onRandSourceChange={(randSource) => setHpingParams((prev: any) => ({ ...prev, randSource }))}
          onSourcePortChange={(sourcePort) => setHpingParams((prev: any) => ({ ...prev, sourcePort }))}
          onDestPortChange={(destPort) => setHpingParams((prev: any) => ({ ...prev, destPort }))}
          onFirewallIdChange={(firewallId) => setHpingParams((prev: any) => ({ ...prev, firewallId }))}
          onPresetApply={onPresetApply}
        />
      )}

      {selectedTool === 'curl' && (
        <CurlParametersForm
          method={curlParams.method}
          path={curlParams.path}
          count={curlParams.count}
          sleep={curlParams.sleep}
          curlInterface={curlParams.interface}
          resolve={curlParams.resolve}
          caCert={curlParams.caCert}
          header={curlParams.header}
          dataBinary={curlParams.dataBinary}
          verbose={curlParams.verbose}
          showHeaders={curlParams.showHeaders}
          veryVerbose={curlParams.veryVerbose}
          insecure={curlParams.insecure}
          onMethodChange={(method) => setCurlParams((prev: any) => ({ ...prev, method }))}
          onPathChange={(path) => setCurlParams((prev: any) => ({ ...prev, path }))}
          onCountChange={(count) => setCurlParams((prev: any) => ({ ...prev, count }))}
          onSleepChange={(sleep) => setCurlParams((prev: any) => ({ ...prev, sleep }))}
          onInterfaceChange={(curlInterface) => setCurlParams((prev: any) => ({ ...prev, interface: curlInterface }))}
          onResolveChange={(resolve) => setCurlParams((prev: any) => ({ ...prev, resolve }))}
          onCaCertChange={(caCert) => setCurlParams((prev: any) => ({ ...prev, caCert }))}
          onHeaderChange={(header) => setCurlParams((prev: any) => ({ ...prev, header }))}
          onDataBinaryChange={(dataBinary) => setCurlParams((prev: any) => ({ ...prev, dataBinary }))}
          onVerboseChange={(verbose) => setCurlParams((prev: any) => ({ ...prev, verbose }))}
          onShowHeadersChange={(showHeaders) => setCurlParams((prev: any) => ({ ...prev, showHeaders }))}
          onVeryVerboseChange={(veryVerbose) => setCurlParams((prev: any) => ({ ...prev, veryVerbose }))}
          onInsecureChange={(insecure) => setCurlParams((prev: any) => ({ ...prev, insecure }))}
        />
      )}

      {/* Action Buttons */}
      <div className={styles.actionButtons}>
        <Button
          onClick={onRunTest}
          disabled={isRunning || !isConfigured}
          style={{
            flex: 1,
            backgroundColor: isRunning ? 'var(--border)' : 'var(--success)',
            cursor: isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          {isRunning ? 'Running...' : 'Run Test'}
        </Button>
        {isRunning && (
          <Button
            onClick={onStopTest}
            style={{ backgroundColor: 'var(--error)' }}
          >
            Stop
          </Button>
        )}
      </div>

      {error && (
        <Alert type="error" message={error} />
      )}
    </Card>
  );
};
