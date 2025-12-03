#!/bin/bash
set -e

# Start FRR daemons
echo "Starting FRR daemons..."
/usr/sbin/frrinit.sh start

# Start softflowd for NetFlow export (if NetFlow collector is configured)
if [ -n "$NETFLOW_COLLECTOR" ]; then
    echo "Starting softflowd for NetFlow export to $NETFLOW_COLLECTOR..."
    sleep 2  # Wait for interfaces to be ready
    # Monitor all non-loopback interfaces
    for iface in eth0 eth1 eth2 eth3; do
        if ip link show "$iface" > /dev/null 2>&1; then
            echo "  Starting softflowd on $iface..."
            # Use softflowd without setsid - it daemonizes itself
            softflowd -i "$iface" -n "$NETFLOW_COLLECTOR" -v 5 -t maxlife=60 -p "/var/run/softflowd-${iface}.pid"
        fi
    done
fi

# Install unified API dependencies
echo "Installing unified BGP API..."
cd /app/api-routing
pip3 install --break-system-packages -q -r requirements.txt 2>&1

# Install PyGoBGP (needed for some shared utilities)
if [ -d "/app/api-routing/PyGoBGP" ]; then
    echo "Installing PyGoBGP..."
    cd /app/api-routing/PyGoBGP
    pip3 install --break-system-packages -q -e . 2>&1
fi

# Start the unified BGP API (FRR-only mode)
echo "Starting unified BGP API on port 5000..."
cd /app
export PYTHONPATH=/app
export DEFAULT_BGP_BACKEND=frr
export FRR_ASN=${LOCAL_ASN:-65000}
export FRR_ROUTER_ID=${LOCAL_ROUTER_ID:-192.168.70.1}
export DAEMON_NAME=${HOSTNAME}

# Disable other backends
export ENABLE_GOBGP=false
export ENABLE_EXABGP=false

python3 -m api-routing.unified_bgp_api &

# Wait for BGP to be fully ready
sleep 3

# Auto-configure FRR BGP policy (disable eBGP policy requirement)
echo "Configuring FRR BGP policies..."
vtysh -c "conf t" -c "router bgp ${LOCAL_ASN:-65000}" -c "no bgp ebgp-requires-policy" -c "end" -c "write mem" 2>&1 || true

# Restore BGP configuration from database
echo "Restoring BGP configuration from database..."
curl -X POST http://localhost:5000/restore 2>/dev/null || echo "  No configuration to restore or restore failed"

# Configure next-hop-self for all neighbors (will be applied to any restored peers)
sleep 2
vtysh -c "conf t" -c "router bgp ${LOCAL_ASN:-65000}" -c "address-family ipv4 unicast" -c "neighbor all next-hop-self" -c "end" -c "write mem" 2>&1 || true

# Start FlowSpec enforcer daemon (converts FlowSpec routes to iptables rules)
echo "Starting FlowSpec enforcer daemon..."
python3 /usr/local/bin/flowspec_enforcer.py --interval 5 &

# Keep container running and show logs
echo "FRR daemon and unified API started"
tail -f /var/log/frr/*.log
