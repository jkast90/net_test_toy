#!/bin/bash
set -e

# Install supervisor if not present
if ! which supervisord > /dev/null 2>&1; then
    apt-get update && apt-get install -y supervisor
fi

# Default config path
GOBGP_CONFIG=${GOBGP_CONFIG:-/etc/gobgp/gobgpd.conf}

# Create directories
mkdir -p /var/log/frr /var/run/frr /etc/gobgp /var/log/supervisor
chown -R frr:frr /var/log/frr /var/run/frr

# Create minimal zebra config
cat > /etc/frr/zebra.conf <<EOF
hostname zebra
log file /var/log/frr/zebra.log
!
EOF
chown frr:frr /etc/frr/zebra.conf

# Generate GoBGP config if not exists
if [ ! -f "$GOBGP_CONFIG" ]; then
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
    echo "Generated GoBGP config: AS=${LOCAL_ASN:-65000}, router_id=${LOCAL_ROUTER_ID:-192.168.70.1}"
fi

# Install Python dependencies
echo "Installing dependencies..."
cd /app/api-routing
pip3 install --break-system-packages -q -r requirements.txt 2>&1
cd /app/api-routing/PyGoBGP
pip3 install --break-system-packages -q -e . 2>&1

# Export environment variables for supervisor
export GOBGP_CONFIG
export LOCAL_ASN=${LOCAL_ASN:-65000}
export LOCAL_ROUTER_ID=${LOCAL_ROUTER_ID:-192.168.70.1}
export GOBGP_ASN=${LOCAL_ASN:-65000}
export GOBGP_ROUTER_ID=${LOCAL_ROUTER_ID:-192.168.70.1}
export DAEMON_NAME=${HOSTNAME}
export DEFAULT_BGP_BACKEND=gobgp
export ENABLE_GOBGP_STREAMING=${ENABLE_GOBGP_STREAMING:-true}

# NetFlow configuration (optional)
export NETFLOW_COLLECTOR=${NETFLOW_COLLECTOR:-}
export NETFLOW_VERSION=${NETFLOW_VERSION:-9}
export NETFLOW_SAMPLING=${NETFLOW_SAMPLING:-1}
export NETFLOW_ACTIVE_TIMEOUT=${NETFLOW_ACTIVE_TIMEOUT:-60}
export NETFLOW_INACTIVE_TIMEOUT=${NETFLOW_INACTIVE_TIMEOUT:-15}

# Copy supervisor config
cp /app/docker_base/gobgp-unified/supervisord.conf /etc/supervisor/conf.d/

# Start supervisor
echo "Starting supervisor..."
exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf