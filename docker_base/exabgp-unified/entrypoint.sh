#!/bin/bash
set -e

# Default config path
EXABGP_CONFIG=${EXABGP_CONFIG:-/etc/exabgp/exabgp.conf}

# Create minimal config if none exists
if [ ! -f "$EXABGP_CONFIG" ]; then
    echo "Creating minimal ExaBGP configuration..."
    cat > "$EXABGP_CONFIG" <<EOF
process announce-routes {
    run python3 -m exabgp healthcheck;
    encoder json;
}

neighbor 127.0.0.1 {
    router-id ${LOCAL_ROUTER_ID:-192.168.70.1};
    local-address ${LOCAL_ROUTER_ID:-192.168.70.1};
    local-as ${LOCAL_ASN:-65000};
    peer-as ${LOCAL_ASN:-65000};
}
EOF
fi

# Start ExaBGP daemon
echo "Starting ExaBGP daemon..."
exabgp "$EXABGP_CONFIG" &

# Wait for ExaBGP to start
sleep 2

# Start softflowd for NetFlow export (if NetFlow collector is configured)
if [ -n "$NETFLOW_COLLECTOR" ]; then
    echo "Starting softflowd for NetFlow export to $NETFLOW_COLLECTOR..."
    softflowd -i eth0 -n "$NETFLOW_COLLECTOR" -v 5 -t maxlife=60 &
fi

# Install unified API dependencies
echo "Installing unified BGP API..."
cd /app/api-routing
pip3 install --break-system-packages -q -r requirements.txt 2>&1

# Install PyGoBGP (for shared utilities)
if [ -d "/app/api-routing/PyGoBGP" ]; then
    echo "Installing PyGoBGP..."
    cd /app/api-routing/PyGoBGP
    pip3 install --break-system-packages -q -e . 2>&1
fi

# Start the unified BGP API (ExaBGP-only mode)
echo "Starting unified BGP API on port 5000..."
cd /app
export PYTHONPATH=/app
export DEFAULT_BGP_BACKEND=exabgp
export EXABGP_ASN=${LOCAL_ASN:-65000}
export EXABGP_ROUTER_ID=${LOCAL_ROUTER_ID:-192.168.70.1}
export EXABGP_CONF="$EXABGP_CONFIG"
export EXABGP_PID_FILE=/var/run/exabgp.pid

# Disable other backends
export ENABLE_GOBGP=false
export ENABLE_FRR=false

python3 -m api-routing.unified_bgp_api &

# Keep container running
echo "ExaBGP daemon and unified API started"
tail -f /dev/null
