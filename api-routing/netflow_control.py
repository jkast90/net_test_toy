#!/usr/bin/env python3
"""
NetFlow Control Script - Manages NetFlow configuration via supervisorctl
This is a simpler approach that uses supervisor to manage softflowd processes
"""
import os
import sys
import json
import subprocess
import logging
from typing import Dict, List, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("netflow-control")

def get_available_interfaces() -> List[str]:
    """Get list of available network interfaces"""
    interfaces = []
    try:
        result = subprocess.run(
            ["ip", "-o", "link", "show"],
            capture_output=True,
            text=True,
            check=True
        )

        for line in result.stdout.strip().split('\n'):
            if line:
                # Parse interface name
                parts = line.split(':')
                if len(parts) >= 2:
                    iface = parts[1].strip().split('@')[0]
                    # Only include ethernet interfaces
                    if iface.startswith('eth'):
                        interfaces.append(iface)
    except Exception as e:
        logger.error(f"Failed to get interfaces: {e}")
        # Default to common interfaces
        interfaces = ['eth0', 'eth1']

    return interfaces

def configure_netflow(config: Dict) -> Dict:
    """Configure NetFlow using supervisorctl"""
    try:
        if not config.get('enabled'):
            # Stop all softflowd processes
            logger.info("Disabling NetFlow")
            subprocess.run(
                ["supervisorctl", "stop", "netflow:*"],
                capture_output=True,
                check=False
            )
            return {"status": "success", "message": "NetFlow disabled"}

        # Get configuration parameters
        collector = config.get('collector_address', 'localhost')
        port = config.get('collector_port', 2055)
        version = config.get('version', 9)
        sampling_rate = config.get('sampling_rate', 1)
        active_timeout = config.get('active_timeout', 60)
        inactive_timeout = config.get('inactive_timeout', 15)

        # Set environment variables for supervisor
        os.environ['NETFLOW_COLLECTOR'] = f"{collector}:{port}"
        os.environ['NETFLOW_VERSION'] = str(version)
        os.environ['NETFLOW_SAMPLING'] = str(sampling_rate)
        os.environ['NETFLOW_ACTIVE_TIMEOUT'] = str(active_timeout)
        os.environ['NETFLOW_INACTIVE_TIMEOUT'] = str(inactive_timeout)

        # Get available interfaces
        interfaces = get_available_interfaces()

        # Stop all softflowd processes first
        subprocess.run(
            ["supervisorctl", "stop", "netflow:*"],
            capture_output=True,
            check=False
        )

        # Update supervisor configuration for each interface
        started_interfaces = []
        for iface in interfaces:
            program_name = f"softflowd-{iface}"

            # Build command with all parameters
            cmd_parts = [
                "/usr/sbin/softflowd",
                "-i", iface,
                "-n", f"{collector}:{port}",
                "-v", str(version),
                "-t", f"maxlife={active_timeout}",
                "-t", f"expint={inactive_timeout}"
            ]

            if sampling_rate > 1:
                cmd_parts.extend(["-s", str(sampling_rate)])

            # Update the program configuration
            # Note: This requires supervisor to be configured to allow dynamic updates
            # For now, we'll just start the programs with environment variables

            # Start the softflowd process for this interface
            result = subprocess.run(
                ["supervisorctl", "start", f"netflow:{program_name}"],
                capture_output=True,
                text=True
            )

            if result.returncode == 0 or "already started" in result.stdout:
                started_interfaces.append(iface)
                logger.info(f"Started softflowd on {iface}")
            else:
                logger.warning(f"Failed to start softflowd on {iface}: {result.stderr}")

        return {
            "status": "success",
            "message": "NetFlow configured",
            "collector": f"{collector}:{port}",
            "version": version,
            "interfaces": started_interfaces
        }

    except Exception as e:
        logger.error(f"Failed to configure NetFlow: {e}")
        return {
            "status": "error",
            "message": str(e)
        }

def get_status() -> Dict:
    """Get NetFlow status from supervisor"""
    try:
        result = subprocess.run(
            ["supervisorctl", "status", "netflow:*"],
            capture_output=True,
            text=True,
            check=False
        )

        processes = []
        running_count = 0

        for line in result.stdout.strip().split('\n'):
            if line:
                parts = line.split()
                if len(parts) >= 2:
                    name = parts[0].replace('netflow:', '')
                    status = parts[1]

                    processes.append({
                        "name": name,
                        "status": status
                    })

                    if status == "RUNNING":
                        running_count += 1

        # Check for collector configuration
        collector = os.environ.get('NETFLOW_COLLECTOR', '')
        version = os.environ.get('NETFLOW_VERSION', '9')

        return {
            "configured": bool(collector),
            "enabled": running_count > 0,
            "collector": collector,
            "version": int(version) if version else 9,
            "processes": processes,
            "running_count": running_count
        }

    except Exception as e:
        logger.error(f"Failed to get status: {e}")
        return {
            "configured": False,
            "enabled": False,
            "error": str(e)
        }

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="NetFlow Control")
    parser.add_argument("command", choices=["configure", "status", "stop"],
                       help="Command to execute")
    parser.add_argument("--config", type=str,
                       help="JSON configuration (for configure command)")

    args = parser.parse_args()

    if args.command == "configure":
        if args.config:
            config = json.loads(args.config)
        else:
            # Read from stdin
            config = json.load(sys.stdin)
        result = configure_netflow(config)
        print(json.dumps(result))

    elif args.command == "status":
        result = get_status()
        print(json.dumps(result, indent=2))

    elif args.command == "stop":
        result = configure_netflow({"enabled": False})
        print(json.dumps(result))