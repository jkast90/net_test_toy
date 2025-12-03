export interface Position {
  x: number;
  y: number;
}

export interface TopologyNode {
  id: string;
  type: 'daemon' | 'host' | 'network';
  label: string;
  position: Position;
  data: any;
  asn?: number;
  color?: string;
}

export interface TopologyLink {
  id: string;
  source: string;
  target: string;
  type: 'network' | 'bgp';
  label?: string;
}

export interface NetworkInfo {
  name: string;
  ips: string[];
}
