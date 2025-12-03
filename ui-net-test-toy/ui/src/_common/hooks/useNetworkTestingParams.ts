/**
 * Network Testing Parameters Hook
 * Manages tool-specific parameter state for network testing tools
 */

import { useState, useCallback } from 'react';
import { buildToolOptions, applyHpingPreset } from '../utils/networkUtils';

export interface PingParams {
  count: number;
  interval: number;
  size: number;
  flood: boolean;
  verbose: boolean;
}

export interface TraceParams {
  maxHops: number;
}

export interface IperfParams {
  duration: number;
  protocol: 'tcp' | 'udp';
  port: number;
}

export interface HpingParams {
  protocol: 'tcp' | 'udp' | 'icmp';
  count: number;
  flood: boolean;
  verbose: boolean;
  frag: boolean;
  syn: boolean;
  ttl: number;
  interval: string;
  data: number;
  randSource: boolean;
  sourcePort: number;
  destPort: number;
  firewallId: number;
  preset: string;
}

export interface CurlParams {
  path: string;
  method: 'GET' | 'POST' | 'DELETE';
  resolve: string;
  interface: string;
  count: number;
  sleep: string;
  caCert: string;
  header: string;
  dataBinary: string;
  verbose: boolean;
  showHeaders: boolean;
  veryVerbose: boolean;
  insecure: boolean;
}

const DEFAULT_PING_PARAMS: PingParams = {
  count: 5,
  interval: 0.2,
  size: 56,
  flood: false,
  verbose: false
};

const DEFAULT_TRACE_PARAMS: TraceParams = {
  maxHops: 30
};

const DEFAULT_IPERF_PARAMS: IperfParams = {
  duration: 5,
  protocol: 'tcp',
  port: 5201
};

const DEFAULT_HPING_PARAMS: HpingParams = {
  protocol: 'tcp',
  count: 1000000,
  flood: false,
  verbose: false,
  frag: false,
  syn: false,
  ttl: 64,
  interval: 'u12',
  data: 8000,
  randSource: false,
  sourcePort: 12345,
  destPort: 12345,
  firewallId: 0,
  preset: ''
};

const DEFAULT_CURL_PARAMS: CurlParams = {
  path: '/',
  method: 'GET',
  resolve: '',
  interface: '',
  count: 10000,
  sleep: '0.001',
  caCert: '',
  header: '',
  dataBinary: '',
  verbose: false,
  showHeaders: false,
  veryVerbose: false,
  insecure: false
};

export const useNetworkTestingParams = () => {
  const [pingParams, setPingParams] = useState<PingParams>(DEFAULT_PING_PARAMS);
  const [traceParams, setTraceParams] = useState<TraceParams>(DEFAULT_TRACE_PARAMS);
  const [iperfParams, setIperfParams] = useState<IperfParams>(DEFAULT_IPERF_PARAMS);
  const [hpingParams, setHpingParams] = useState<HpingParams>(DEFAULT_HPING_PARAMS);
  const [curlParams, setCurlParams] = useState<CurlParams>(DEFAULT_CURL_PARAMS);

  // Apply hping preset
  const applyPreset = useCallback((preset: string) => {
    const updated = applyHpingPreset(preset, hpingParams);
    setHpingParams(updated);
  }, [hpingParams]);

  // Build options for the selected tool
  const getToolOptions = useCallback((selectedTool: string) => {
    return buildToolOptions(
      selectedTool,
      pingParams,
      traceParams,
      iperfParams,
      hpingParams,
      curlParams
    );
  }, [pingParams, traceParams, iperfParams, hpingParams, curlParams]);

  // Reset all params to defaults
  const resetAllParams = useCallback(() => {
    setPingParams(DEFAULT_PING_PARAMS);
    setTraceParams(DEFAULT_TRACE_PARAMS);
    setIperfParams(DEFAULT_IPERF_PARAMS);
    setHpingParams(DEFAULT_HPING_PARAMS);
    setCurlParams(DEFAULT_CURL_PARAMS);
  }, []);

  return {
    // Ping
    pingParams,
    setPingParams,

    // Trace
    traceParams,
    setTraceParams,

    // Iperf
    iperfParams,
    setIperfParams,

    // Hping
    hpingParams,
    setHpingParams,
    applyPreset,

    // Curl
    curlParams,
    setCurlParams,

    // Utilities
    getToolOptions,
    resetAllParams
  };
};
