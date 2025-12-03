#!/bin/bash
set -e

# Environment variables:
# - COLLECTOR_IP: NetFlow collector IP address
# - COLLECTOR_PORT: NetFlow collector UDP port
# - TAP_INTERFACE: Interface to monitor (default: eth0)
# - NETFLOW_VERSION: NetFlow version (default: 5)

COLLECTOR_IP=${COLLECTOR_IP:-"172.22.0.3"}
COLLECTOR_PORT=${COLLECTOR_PORT:-2055}
TAP_INTERFACE=${TAP_INTERFACE:-"eth0"}
NETFLOW_VERSION=${NETFLOW_VERSION:-5}

echo "[NetFlow Tap] Starting softflowd on ${TAP_INTERFACE}"
echo "[NetFlow Tap] Collector: ${COLLECTOR_IP}:${COLLECTOR_PORT}"
echo "[NetFlow Tap] Version: ${NETFLOW_VERSION}"

# Wait for interface to be ready
for i in {1..30}; do
    if ip link show ${TAP_INTERFACE} &>/dev/null; then
        echo "[NetFlow Tap] Interface ${TAP_INTERFACE} is ready"
        break
    fi
    echo "[NetFlow Tap] Waiting for interface ${TAP_INTERFACE}... ($i/30)"
    sleep 1
done

# Bring up the interface and enable promiscuous mode
ip link set ${TAP_INTERFACE} up
ip link set ${TAP_INTERFACE} promisc on

# Start pmacct (pmacctd) to export NetFlow
# pmacctd can capture packets and export as NetFlow v5/v9 or IPFIX
echo "[NetFlow Tap] Starting pmacctd..."
echo "[NetFlow Tap] Exporting to ${COLLECTOR_IP}:${COLLECTOR_PORT}"

# Create pmacctd configuration
# Note: pcap_ifindex is the correct config key for interface, but we use -i flag for clarity
cat > /tmp/pmacctd.conf <<EOF
!
! pmacctd configuration for NetFlow export
!
daemonize: false
promisc: true
pcap_filter: ip
aggregate: src_host, dst_host, src_port, dst_port, proto, tos
plugins: nfprobe
nfprobe_receiver: ${COLLECTOR_IP}:${COLLECTOR_PORT}
nfprobe_version: ${NETFLOW_VERSION}
nfprobe_engine: 0:0
EOF

# Start pmacctd with explicit interface flag
exec pmacctd -i ${TAP_INTERFACE} -f /tmp/pmacctd.conf
