#!/bin/bash
set -e

# Default config path
GOBGP_CONFIG=${GOBGP_CONFIG:-/etc/gobgp/gobgpd.conf}

# IP forwarding is configured via Docker sysctls
# (see docker-compose.yml or container creation with sysctls settings)
echo "IP forwarding should be configured via Docker sysctls..."

# Start zebra first (for route redistribution)
echo "Starting FRR zebra daemon..."
mkdir -p /var/log/frr /var/run/frr
chown -R frr:frr /var/log/frr /var/run/frr

# Create minimal zebra config
cat > /etc/frr/zebra.conf <<EOF
hostname zebra
log file /var/log/frr/zebra.log
!
EOF
chown frr:frr /etc/frr/zebra.conf

# Start zebra
/usr/lib/frr/zebra -d -A 127.0.0.1

# Wait for zebra to start
sleep 2

# Start GoBGP daemon with zebra integration
echo "Starting GoBGP daemon with zebra integration..."
if [ -f "$GOBGP_CONFIG" ]; then
    gobgpd -f "$GOBGP_CONFIG" -p -t yaml &
else
    # Generate config with zebra integration
    mkdir -p /etc/gobgp
    cat > /etc/gobgp/gobgpd.conf <<EOF
global:
  config:
    as: ${LOCAL_ASN:-65000}
    router-id: ${LOCAL_ROUTER_ID:-192.168.70.1}
    port: 179

zebra:
  config:
    enabled: true
    url: "unix:/var/run/frr/zserv.api"
    redistribute-route-type-list:
      - "connect"
    version: 6
EOF
    echo "Generated GoBGP config with zebra: AS=${LOCAL_ASN:-65000}, router_id=${LOCAL_ROUTER_ID:-192.168.70.1}"
    gobgpd -f /etc/gobgp/gobgpd.conf -p -t yaml &
fi

# Wait for GoBGP to start
sleep 2

# Start softflowd for NetFlow export (if NetFlow collector is configured)
if [ -n "$NETFLOW_COLLECTOR" ]; then
    echo "Starting softflowd for NetFlow export to ${NETFLOW_COLLECTOR}..."
    # Monitor all non-loopback interfaces
    for iface in eth0 eth1 eth2 eth3; do
        if ip link show "$iface" > /dev/null 2>&1; then
            echo "  Starting softflowd on $iface..."
            # Use softflowd without setsid - it daemonizes itself
            softflowd -i "$iface" -n "${NETFLOW_COLLECTOR}" -v 5 -t maxlife=60 -p "/var/run/softflowd-${iface}.pid"
        fi
    done
fi

# Install unified API dependencies
echo "Installing unified BGP API..."
cd /app/api-routing
pip3 install --break-system-packages -q -r requirements.txt 2>&1

# Install PyGoBGP
echo "Installing PyGoBGP..."
cd /app/api-routing/PyGoBGP
pip3 install --break-system-packages -q -e . 2>&1

# Start the unified BGP API (GoBGP-only mode)
echo "Starting unified BGP API on port 5000..."
cd /app
export PYTHONPATH=/app
export DEFAULT_BGP_BACKEND=gobgp
export GOBGP_ASN=${LOCAL_ASN:-65000}
export GOBGP_ROUTER_ID=${LOCAL_ROUTER_ID:-192.168.70.1}
export GOBGP_HOST=localhost
export GOBGP_PORT=50051
export ENABLE_GOBGP_STREAMING=${ENABLE_GOBGP_STREAMING:-true}
export DAEMON_NAME=${HOSTNAME}

# Disable other backends
export ENABLE_FRR=false
export ENABLE_EXABGP=false

python3 -m api-routing.unified_bgp_api &

# Start route installer to automatically install BGP routes into kernel
echo "Starting route installer..."
export GOBGP_HOST=localhost
export GOBGP_PORT=50051
export ROUTE_SYNC_INTERVAL=5
python3 /app/api-routing/gobgp/route_installer.py 2>&1 &

# Wait for BGP to be fully ready
sleep 3

# Restore BGP configuration from database
echo "Restoring BGP configuration from database..."
curl -X POST http://localhost:5000/restore 2>/dev/null || echo "  No configuration to restore or restore failed"

# Keep container running
echo "GoBGP daemon, unified API, and route installer started"
tail -f /dev/null
