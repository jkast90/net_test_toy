/**
 * Network utility functions and constants
 * Used across BGP and NetFlow components
 */

// ===========================
// Protocol Constants
// ===========================

export const PROTOCOL_NAMES: { [key: number]: string } = {
  1: 'ICMP',
  6: 'TCP',
  17: 'UDP',
  47: 'GRE',
  50: 'ESP',
  89: 'OSPF'
};

// ===========================
// Formatting Functions
// ===========================

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export const formatRate = (value: number, unit: string): string => {
  if (value === 0) return `0 ${unit}/s`;
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M ${unit}/s`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(2)}K ${unit}/s`;
  }
  return `${value.toFixed(2)} ${unit}/s`;
};

export const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

// ===========================
// IP Address Utilities
// ===========================

/**
 * Removes CIDR notation from an IP address
 * @example stripCIDR('192.168.1.1/24') // '192.168.1.1'
 * @example stripCIDR('192.168.1.1') // '192.168.1.1'
 */
export const stripCIDR = (ip: string): string => {
  return ip.split('/')[0];
};

// ===========================
// BGP State Utilities
// ===========================

/**
 * Checks if a BGP neighbor is in established state
 * Handles both numeric (6) and string ('Established') formats
 */
export const isBGPEstablished = (state: number | string): boolean => {
  return state === 6 || state === 'Established';
};

/**
 * Gets a human-readable BGP state name
 */
export const getBGPStateName = (state: number | string): string => {
  if (typeof state === 'string') return state;

  const stateNames: { [key: number]: string } = {
    1: 'Idle',
    2: 'Connect',
    3: 'Active',
    4: 'OpenSent',
    5: 'OpenConfirm',
    6: 'Established'
  };

  return stateNames[state] || `Unknown (${state})`;
};

// ===========================
// Number Formatting Utilities
// ===========================

/**
 * Formats a number to a fixed decimal precision
 * @example formatDecimal(3.14159, 2) // '3.14'
 * @example formatDecimal(1000.5, 0) // '1001'
 */
export const formatDecimal = (value: number, decimals: number = 2): string => {
  return value.toFixed(decimals);
};

/**
 * Calculates percentage and returns as a rounded number
 * @example calculatePercentage(50, 100) // 50
 * @example calculatePercentage(1, 3) // 33
 */
export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

/**
 * Formats a number with thousands separators
 * @example formatNumber(1000) // '1,000'
 * @example formatNumber(1234567) // '1,234,567'
 */
export const formatNumber = (value: number): string => {
  return value.toLocaleString();
};

// ===========================
// Lab Host IP Utilities
// ===========================

export interface IPOption {
  ip: string;
  label: string;
}

/**
 * Extracts all IP addresses from a lab host
 * Returns array of {ip, label} objects for display in dropdowns
 * Filters out gateway IPs and Docker-assigned primary IPs
 */
export const getAllIPs = (host: any): IPOption[] => {
  const ips: IPOption[] = [];

  if (host.loopback_ip) {
    ips.push({ ip: host.loopback_ip, label: `Loopback (${host.loopback_ip})` });
  }
  // Gateway IP is excluded - it belongs to the router, not the host
  if (host.container_ip) {
    ips.push({ ip: host.container_ip, label: `Container (${host.container_ip})` });
  }
  if (host.networks) {
    host.networks.forEach((network: any) => {
      if (network.ips && network.ips.length > 0) {
        // For networks with multiple IPs, prefer the last one (manually configured secondary IP)
        // Skip the first IP as it's typically the Docker-assigned primary IP
        const targetIP = network.ips.length > 1 ? network.ips[network.ips.length - 1] : network.ips[0];
        const ip = stripCIDR(targetIP);
        ips.push({ ip, label: `${network.name} (${ip})` });
      }
    });
  }
  if (host.tunnels) {
    host.tunnels.forEach((tunnel: any) => {
      const ip = stripCIDR(tunnel.tunnel_ip);
      ips.push({ ip, label: `Tunnel ${tunnel.tunnel_name} (${ip} → ${tunnel.remote_ip})` });
    });
  }

  return ips;
};

// ===========================
// Network Testing Utilities
// ===========================

/**
 * HPing preset configurations for different attack scenarios
 */
export const applyHpingPreset = (preset: string, currentParams: any) => {
  const updates = { ...currentParams, preset };

  switch (preset) {
    case 'SYN Flood':
      return { ...updates, syn: true, flood: true, verbose: true };
    case 'UDP Flood':
      return { ...updates, protocol: 'udp', flood: true, verbose: true };
    case 'ICMP Flood':
      return { ...updates, protocol: 'icmp', flood: true, verbose: true };
    case 'Random Source SYN Flood':
      return { ...updates, syn: true, flood: true, randSource: true, verbose: true };
    case 'All out Traffic':
      return { ...updates, syn: true, flood: true, verbose: true, frag: true, interval: 'u1', count: 300000000 };
    case 'High Traffic':
      return { ...updates, syn: true, flood: true, verbose: true, frag: true, interval: 'u20', count: 30000000 };
    case 'Medium Traffic':
      return { ...updates, syn: true, flood: true, verbose: true, frag: true, interval: 'u370', count: 3000000 };
    case 'Low Traffic':
      return { ...updates, syn: true, flood: true, verbose: true, frag: true, interval: 'u350', count: 22500 };
    default:
      return updates;
  }
};

/**
 * Builds test parameters based on tool type and options
 */
export const buildToolOptions = (
  tool: string,
  pingParams: any,
  traceParams: any,
  iperfParams: any,
  hpingParams: any,
  curlParams: any
): Record<string, any> => {
  switch (tool) {
    case 'ping':
      return pingParams;
    case 'traceroute':
      return traceParams;
    case 'iperf':
      return iperfParams;
    case 'hping':
      return {
        protocol: hpingParams.protocol,
        count: hpingParams.count,
        flood: hpingParams.flood,
        verbose: hpingParams.verbose,
        frag: hpingParams.frag,
        syn: hpingParams.syn,
        ttl: hpingParams.ttl,
        interval: hpingParams.interval,
        data: hpingParams.data,
        rand_source: hpingParams.randSource,
        source_port: hpingParams.sourcePort,
        dest_port: hpingParams.destPort,
        firewall_id: hpingParams.firewallId
      };
    case 'curl':
      return {
        path: curlParams.path,
        method: curlParams.method,
        resolve: curlParams.resolve,
        interface: curlParams.interface,
        count: curlParams.count,
        sleep: curlParams.sleep,
        ca_cert: curlParams.caCert,
        header: curlParams.header,
        data_binary: curlParams.dataBinary,
        verbose: curlParams.verbose,
        show_headers: curlParams.showHeaders,
        very_verbose: curlParams.veryVerbose,
        insecure: curlParams.insecure
      };
    default:
      return {};
  }
};
