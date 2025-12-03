/**
 * Color Palette for Topology Items
 * Provides a curated set of colors for network topology visualization
 */

// Default color palette - carefully chosen for visibility and aesthetics
export const COLOR_PALETTE = [
  '#81C784', // Green (GoBGP default)
  '#1976D2', // Blue (FRR default)
  '#FF9800', // Orange (ExaBGP default)
  '#E91E63', // Pink
  '#9C27B0', // Purple
  '#00BCD4', // Cyan
  '#4CAF50', // Light Green
  '#FF5722', // Deep Orange
  '#3F51B5', // Indigo
  '#009688', // Teal
  '#CDDC39', // Lime
  '#FFC107', // Amber
  '#795548', // Brown
  '#607D8B', // Blue Grey
  '#F44336', // Red
  '#2196F3', // Light Blue
] as const;

// Default colors by node type
export const DEFAULT_COLORS = {
  daemon: {
    gobgp: '#81C784',
    frr: '#1976D2',
    exabgp: '#FF9800',
    default: '#9E9E9E'
  },
  host: '#9C27B0',
  network: '#757575',
  external_node: '#FF9800',
  external_network: '#00BCD4'
} as const;

/**
 * Get default color for a daemon based on its type
 */
export const getDaemonColor = (type: string | undefined): string => {
  if (!type) return DEFAULT_COLORS.daemon.default;
  const daemonType = type.toLowerCase() as keyof typeof DEFAULT_COLORS.daemon;
  return DEFAULT_COLORS.daemon[daemonType] || DEFAULT_COLORS.daemon.default;
};

/**
 * Get default color for any node type
 */
export const getDefaultColor = (nodeType: string, daemonType?: string): string => {
  switch (nodeType) {
    case 'daemon':
      return getDaemonColor(daemonType);
    case 'host':
      return DEFAULT_COLORS.host;
    case 'network':
      return DEFAULT_COLORS.network;
    case 'external_node':
      return DEFAULT_COLORS.external_node;
    case 'external_network':
      return DEFAULT_COLORS.external_network;
    default:
      return '#9E9E9E';
  }
};
