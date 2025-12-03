#!/bin/sh
# NetFlow wrapper script that reads configuration from mounted JSON file
# This script monitors /etc/netflow/config.json and manages softflowd processes

CONFIG_FILE="/etc/netflow/config.json"
PID_DIR="/var/run/netflow"
LOG_FILE="/var/log/netflow-wrapper.log"

# Create PID directory
mkdir -p "$PID_DIR"

# Function to read JSON config value
get_config_value() {
    if [ -f "$CONFIG_FILE" ]; then
        python3 -c "import json; c=json.load(open('$CONFIG_FILE')); print(c.get('$1', '$2'))"
    else
        echo "$2"
    fi
}

# Function to stop all softflowd processes
stop_all_softflowd() {
    echo "$(date): Stopping all softflowd processes..." >> "$LOG_FILE"
    killall softflowd 2>/dev/null || true
    rm -f "$PID_DIR"/softflowd-*.pid
}

# Function to start softflowd on an interface
start_softflowd() {
    local iface="$1"
    local collector="$2"
    local version="$3"
    local active_timeout="$4"
    local inactive_timeout="$5"
    local sampling_rate="$6"

    echo "$(date): Starting softflowd on $iface -> $collector" >> "$LOG_FILE"

    # Build command
    cmd="softflowd -i $iface -n $collector -v $version"
    cmd="$cmd -t maxlife=$active_timeout -t expint=$inactive_timeout"

    if [ "$sampling_rate" -gt 1 ]; then
        cmd="$cmd -s $sampling_rate"
    fi

    # Add PID file
    cmd="$cmd -p $PID_DIR/softflowd-$iface.pid"

    # Start in background
    $cmd &

    echo "$(date): Started: $cmd" >> "$LOG_FILE"
}

# Main monitoring loop
echo "$(date): NetFlow wrapper started" >> "$LOG_FILE"

while true; do
    if [ -f "$CONFIG_FILE" ]; then
        # Read configuration
        enabled=$(get_config_value "enabled" "false")

        if [ "$enabled" = "True" ] || [ "$enabled" = "true" ]; then
            # Get configuration values
            collector_address=$(get_config_value "collector_address" "localhost")
            collector_port=$(get_config_value "collector_port" "2055")
            version=$(get_config_value "version" "9")
            active_timeout=$(get_config_value "active_timeout" "60")
            inactive_timeout=$(get_config_value "inactive_timeout" "15")
            sampling_rate=$(get_config_value "sampling_rate" "1")

            collector="$collector_address:$collector_port"

            # Check each interface
            for iface in eth0 eth1 eth2 eth3; do
                if [ -e "/sys/class/net/$iface" ]; then
                    # Check if softflowd is already running on this interface
                    if [ -f "$PID_DIR/softflowd-$iface.pid" ]; then
                        pid=$(cat "$PID_DIR/softflowd-$iface.pid")
                        if ! kill -0 "$pid" 2>/dev/null; then
                            # Process dead, restart it
                            echo "$(date): softflowd on $iface died, restarting..." >> "$LOG_FILE"
                            start_softflowd "$iface" "$collector" "$version" \
                                          "$active_timeout" "$inactive_timeout" "$sampling_rate"
                        fi
                    else
                        # Not running, start it
                        start_softflowd "$iface" "$collector" "$version" \
                                      "$active_timeout" "$inactive_timeout" "$sampling_rate"
                    fi
                fi
            done
        else
            # NetFlow disabled, stop all processes
            stop_all_softflowd
        fi
    else
        echo "$(date): No config file at $CONFIG_FILE" >> "$LOG_FILE"
    fi

    # Sleep before next check
    sleep 10
done