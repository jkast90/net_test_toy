#!/usr/bin/env python3
"""
NetFlow Manager - Manages softflowd processes dynamically
This runs as a background service in the container and responds to configuration changes
"""
import os
import json
import subprocess
import signal
import time
import logging
from pathlib import Path
from typing import Dict, Optional, List

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("netflow-manager")

class NetFlowManager:
    """Manages softflowd processes for NetFlow export"""

    def __init__(self):
        self.config_file = Path("/etc/netflow/config.json")
        self.pid_dir = Path("/var/run/netflow")
        self.running_processes: Dict[str, int] = {}

        # Create directories if they don't exist
        self.config_file.parent.mkdir(parents=True, exist_ok=True)
        self.pid_dir.mkdir(parents=True, exist_ok=True)

    def load_config(self) -> Optional[Dict]:
        """Load NetFlow configuration from file"""
        if not self.config_file.exists():
            return None

        try:
            with open(self.config_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
            return None

    def save_config(self, config: Dict):
        """Save NetFlow configuration to file"""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2)
            logger.info(f"Saved NetFlow configuration: {config}")
        except Exception as e:
            logger.error(f"Failed to save config: {e}")

    def get_available_interfaces(self) -> List[str]:
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
                        # Skip loopback and virtual interfaces
                        if iface not in ['lo', 'tunl0', 'gre0', 'gretap0', 'erspan0',
                                        'ip_vti0', 'ip6_vti0', 'sit0', 'ip6tnl0', 'ip6gre0']:
                            interfaces.append(iface)
        except Exception as e:
            logger.error(f"Failed to get interfaces: {e}")
            # Default to common interfaces
            interfaces = ['eth0', 'eth1']

        return interfaces

    def start_softflowd(self, interface: str, collector: str, port: int,
                       version: int = 9, sampling_rate: int = 1,
                       active_timeout: int = 60, inactive_timeout: int = 15) -> bool:
        """Start softflowd on a specific interface"""
        pid_file = self.pid_dir / f"softflowd-{interface}.pid"

        # Check if already running
        if interface in self.running_processes:
            logger.info(f"softflowd already running on {interface}")
            return True

        # Build command
        cmd = [
            "softflowd",
            "-i", interface,
            "-n", f"{collector}:{port}",
            "-v", str(version),
            "-t", f"maxlife={active_timeout}",
            "-t", f"expint={inactive_timeout}",
            "-p", str(pid_file)
        ]

        if sampling_rate > 1:
            cmd.extend(["-s", str(sampling_rate)])

        try:
            # Start softflowd
            logger.info(f"Starting softflowd on {interface}: {' '.join(cmd)}")
            process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            # Wait a moment for it to start
            time.sleep(1)

            # Check if it's still running
            if process.poll() is None:
                self.running_processes[interface] = process.pid
                logger.info(f"Started softflowd on {interface} with PID {process.pid}")
                return True
            else:
                logger.error(f"softflowd failed to start on {interface}")
                return False

        except Exception as e:
            logger.error(f"Failed to start softflowd on {interface}: {e}")
            return False

    def stop_softflowd(self, interface: str) -> bool:
        """Stop softflowd on a specific interface"""
        if interface not in self.running_processes:
            logger.info(f"No softflowd process running on {interface}")
            return True

        pid = self.running_processes[interface]
        pid_file = self.pid_dir / f"softflowd-{interface}.pid"

        try:
            # Send SIGTERM
            os.kill(pid, signal.SIGTERM)
            logger.info(f"Stopped softflowd on {interface} (PID {pid})")

            # Remove from tracking
            del self.running_processes[interface]

            # Clean up PID file
            if pid_file.exists():
                pid_file.unlink()

            return True

        except ProcessLookupError:
            # Process already dead
            logger.info(f"softflowd process {pid} already terminated")
            del self.running_processes[interface]
            if pid_file.exists():
                pid_file.unlink()
            return True

        except Exception as e:
            logger.error(f"Failed to stop softflowd on {interface}: {e}")
            return False

    def stop_all(self):
        """Stop all running softflowd processes"""
        interfaces = list(self.running_processes.keys())
        for interface in interfaces:
            self.stop_softflowd(interface)

    def apply_config(self, config: Dict):
        """Apply NetFlow configuration"""
        if not config or not config.get('enabled'):
            # Disable NetFlow - stop all processes
            logger.info("Disabling NetFlow")
            self.stop_all()
            return

        # Get configuration parameters
        collector = config.get('collector_address', 'localhost')
        port = config.get('collector_port', 2055)
        version = config.get('version', 9)
        sampling_rate = config.get('sampling_rate', 1)
        active_timeout = config.get('active_timeout', 60)
        inactive_timeout = config.get('inactive_timeout', 15)
        interfaces = config.get('interfaces', [])

        # If no specific interfaces, use all available
        if not interfaces:
            interfaces = self.get_available_interfaces()

        # Stop softflowd on interfaces not in the list
        for interface in list(self.running_processes.keys()):
            if interface not in interfaces:
                self.stop_softflowd(interface)

        # Start/restart softflowd on specified interfaces
        for interface in interfaces:
            # Stop if running (to apply new config)
            if interface in self.running_processes:
                self.stop_softflowd(interface)

            # Start with new config
            self.start_softflowd(
                interface, collector, port, version,
                sampling_rate, active_timeout, inactive_timeout
            )

    def check_processes(self):
        """Check if tracked processes are still running"""
        for interface in list(self.running_processes.keys()):
            pid = self.running_processes[interface]
            try:
                # Check if process exists
                os.kill(pid, 0)
            except ProcessLookupError:
                # Process dead, remove from tracking
                logger.warning(f"softflowd on {interface} (PID {pid}) has died")
                del self.running_processes[interface]

    def get_status(self) -> Dict:
        """Get current NetFlow status"""
        self.check_processes()

        config = self.load_config()

        return {
            "configured": config is not None,
            "enabled": config.get('enabled', False) if config else False,
            "collector": f"{config.get('collector_address')}:{config.get('collector_port')}" if config else None,
            "version": config.get('version') if config else None,
            "running_interfaces": list(self.running_processes.keys()),
            "processes": [
                {
                    "interface": iface,
                    "pid": pid,
                    "status": "running"
                }
                for iface, pid in self.running_processes.items()
            ]
        }

    def reload_config(self):
        """Reload configuration from file"""
        config = self.load_config()
        if config:
            logger.info("Reloading configuration...")
            self.apply_config(config)
        else:
            logger.warning("No configuration file found")

    def monitor_loop(self):
        """Main monitoring loop - watches for config changes"""
        logger.info("NetFlow Manager started")

        last_mtime = 0
        last_config = None

        # Check for config path from environment (for mounted configs)
        config_path_env = os.environ.get('NETFLOW_CONFIG_PATH')
        if config_path_env:
            self.config_file = Path(config_path_env)
            logger.info(f"Using config path from environment: {self.config_file}")

        # Check for initial config from environment variables (legacy support)
        if not self.config_file.exists() and os.environ.get('NETFLOW_COLLECTOR'):
            initial_config = {
                "enabled": True,
                "collector_address": os.environ['NETFLOW_COLLECTOR'].split(':')[0],
                "collector_port": int(os.environ['NETFLOW_COLLECTOR'].split(':')[1]) if ':' in os.environ['NETFLOW_COLLECTOR'] else 2055,
                "version": int(os.environ.get('NETFLOW_VERSION', 9)),
                "sampling_rate": int(os.environ.get('NETFLOW_SAMPLING', 1)),
                "active_timeout": int(os.environ.get('NETFLOW_ACTIVE_TIMEOUT', 60)),
                "inactive_timeout": int(os.environ.get('NETFLOW_INACTIVE_TIMEOUT', 15))
            }
            self.save_config(initial_config)
            self.apply_config(initial_config)
        elif self.config_file.exists():
            # Load and apply existing config
            config = self.load_config()
            if config:
                self.apply_config(config)
                last_config = config
                last_mtime = self.config_file.stat().st_mtime

        while True:
            try:
                # Check if config file has changed
                if self.config_file.exists():
                    mtime = self.config_file.stat().st_mtime
                    if mtime > last_mtime:
                        config = self.load_config()
                        if config != last_config:
                            logger.info("Configuration changed, applying...")
                            self.apply_config(config)
                            last_config = config
                        last_mtime = mtime

                # Check process health
                self.check_processes()

                # If processes died but should be running, restart
                if last_config and last_config.get('enabled'):
                    expected_interfaces = last_config.get('interfaces', [])
                    if not expected_interfaces:
                        expected_interfaces = self.get_available_interfaces()

                    for interface in expected_interfaces:
                        if interface not in self.running_processes:
                            logger.info(f"Restarting softflowd on {interface}")
                            self.start_softflowd(
                                interface,
                                last_config.get('collector_address', 'localhost'),
                                last_config.get('collector_port', 2055),
                                last_config.get('version', 9),
                                last_config.get('sampling_rate', 1),
                                last_config.get('active_timeout', 60),
                                last_config.get('inactive_timeout', 15)
                            )

            except Exception as e:
                logger.error(f"Error in monitor loop: {e}")

            # Check every 5 seconds
            time.sleep(5)

def signal_handler(signum, frame):
    """Handle shutdown signals"""
    logger.info(f"Received signal {signum}, shutting down...")
    manager.stop_all()
    exit(0)

def reload_handler(signum, frame):
    """Handle SIGHUP for config reload"""
    logger.info(f"Received SIGHUP, reloading configuration...")
    manager.reload_config()

if __name__ == "__main__":
    # Create manager instance
    manager = NetFlowManager()

    # Set up signal handlers
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGHUP, reload_handler)

    try:
        manager.monitor_loop()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        manager.stop_all()