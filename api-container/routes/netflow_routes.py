"""
NetFlow Configuration Routes
Handles NetFlow/IPFIX configuration for BGP daemons and hosts
"""
from fastapi import APIRouter, HTTPException, Query, Path
from ..models import NetFlowConfig
import logging
import json
import re
from pathlib import Path as PathLib


router = APIRouter(prefix="/daemons", tags=["netflow"])
logger = logging.getLogger(__name__)


def configure_gobgp_netflow(container_manager, daemon_name: str, daemon_info: dict, config: NetFlowConfig) -> dict:
    """Configure NetFlow using shared mounted config"""
    try:
        # Prepare NetFlow configuration
        netflow_config = {
            "enabled": config.enabled,
            "collector_address": config.collector_address,
            "collector_port": config.collector_port,
            "version": config.version,
            "sampling_rate": config.sampling_rate or 1,
            "active_timeout": config.active_timeout,
            "inactive_timeout": config.inactive_timeout
        }

        # Write to host config file (mounted in containers at /etc/netflow/config.json)
        # The host path should be relative to where the API container is running
        host_config_path = PathLib("/configs/netflow/config.json")

        # Ensure directory exists
        host_config_path.parent.mkdir(parents=True, exist_ok=True)

        # Write configuration to host file
        with open(host_config_path, 'w') as f:
            json.dump(netflow_config, f, indent=2)

        logger.info(f"Updated shared NetFlow config: {netflow_config}")

        # Signal the NetFlow Manager to reload config (if running)
        signal_cmd = "pkill -HUP -f netflow_manager 2>/dev/null || true"
        container_manager.exec_in_container(daemon_name, signal_cmd)

        # Ensure NetFlow wrapper is running (should be mounted at /scripts/netflow-wrapper.sh)
        check_wrapper_cmd = "ps aux | grep -v grep | grep netflow-wrapper"
        wrapper_result = container_manager.exec_in_container(daemon_name, check_wrapper_cmd)

        if "netflow-wrapper" not in wrapper_result.get("output", ""):
            # Check if wrapper script exists
            check_script_cmd = "test -f /scripts/netflow-wrapper.sh && echo 'exists' || echo 'missing'"
            script_result = container_manager.exec_in_container(daemon_name, check_script_cmd)

            if "exists" in script_result.get("output", ""):
                # Start the wrapper script
                start_wrapper_cmd = "nohup /scripts/netflow-wrapper.sh > /var/log/netflow-wrapper.log 2>&1 &"
                container_manager.exec_in_container(daemon_name, start_wrapper_cmd)
                logger.info(f"Started NetFlow wrapper on {daemon_name}")
            else:
                logger.warning(f"NetFlow wrapper script not found on {daemon_name}. Mount /scripts/netflow-wrapper.sh to enable dynamic NetFlow.")

        # Give wrapper time to process the config
        import time
        time.sleep(2)

        # Verify and return status
        verify_cmd = "ps aux | grep -v grep | grep softflowd | wc -l"
        verify_result = container_manager.exec_in_container(daemon_name, verify_cmd)
        running_count = int(verify_result.get("output", "0").strip())

        if config.enabled:
            return {
                "status": "success",
                "daemon": daemon_name,
                "type": "gobgp",
                "netflow": {
                    "enabled": True,
                    "collector": f"{config.collector_address}:{config.collector_port}",
                    "version": config.version,
                    "running_processes": running_count,
                    "method": "mounted-config"
                },
                "message": f"NetFlow configuration updated, {running_count} processes running"
            }
        else:
            return {
                "status": "success",
                "daemon": daemon_name,
                "type": "gobgp",
                "netflow": {
                    "enabled": False,
                    "running_processes": running_count
                },
                "message": "NetFlow disabled"
            }

    except Exception as e:
        raise Exception(f"Failed to configure NetFlow on GoBGP: {str(e)}")


def configure_frr_netflow(container_manager, daemon_name: str, daemon_info: dict, config: NetFlowConfig) -> dict:
    """Configure NetFlow on FRR using shared mounted config"""
    try:
        # Use the same shared configuration approach as GoBGP
        netflow_config = {
            "enabled": config.enabled,
            "collector_address": config.collector_address,
            "collector_port": config.collector_port,
            "version": config.version,
            "sampling_rate": config.sampling_rate or 1,
            "active_timeout": config.active_timeout,
            "inactive_timeout": config.inactive_timeout
        }

        # Write to shared config file
        host_config_path = PathLib("/configs/netflow/config.json")
        host_config_path.parent.mkdir(parents=True, exist_ok=True)

        with open(host_config_path, 'w') as f:
            json.dump(netflow_config, f, indent=2)

        logger.info(f"Updated shared NetFlow config for FRR: {netflow_config}")

        # Signal the NetFlow Manager to reload config (if running)
        signal_cmd = "pkill -HUP -f netflow_manager 2>/dev/null || true"
        container_manager.exec_in_container(daemon_name, signal_cmd)

        # Ensure NetFlow wrapper is running (should be mounted at /scripts/netflow-wrapper.sh)
        check_wrapper_cmd = "ps aux | grep -v grep | grep netflow-wrapper"
        wrapper_result = container_manager.exec_in_container(daemon_name, check_wrapper_cmd)

        if "netflow-wrapper" not in wrapper_result.get("output", ""):
            # Check if wrapper script exists
            check_script_cmd = "test -f /scripts/netflow-wrapper.sh && echo 'exists' || echo 'missing'"
            script_result = container_manager.exec_in_container(daemon_name, check_script_cmd)

            if "exists" in script_result.get("output", ""):
                # Start the wrapper script
                start_wrapper_cmd = "nohup /scripts/netflow-wrapper.sh > /var/log/netflow-wrapper.log 2>&1 &"
                container_manager.exec_in_container(daemon_name, start_wrapper_cmd)
                logger.info(f"Started NetFlow wrapper on {daemon_name}")
            else:
                logger.warning(f"NetFlow wrapper script not found on {daemon_name}. Mount /scripts/netflow-wrapper.sh to enable dynamic NetFlow.")

        # Give wrapper time to process the config
        import time
        time.sleep(2)

        # Verify and return status
        verify_cmd = "ps aux | grep -v grep | grep softflowd | wc -l"
        verify_result = container_manager.exec_in_container(daemon_name, verify_cmd)
        running_count = int(verify_result.get("output", "0").strip())

        if config.enabled:
            return {
                "status": "success",
                "daemon": daemon_name,
                "type": "frr",
                "netflow": {
                    "enabled": True,
                    "collector": f"{config.collector_address}:{config.collector_port}",
                    "version": config.version,
                    "running_processes": running_count,
                    "method": "mounted-config"
                },
                "message": f"NetFlow configuration updated, {running_count} processes running"
            }
        else:
            return {
                "status": "success",
                "daemon": daemon_name,
                "type": "frr",
                "netflow": {
                    "enabled": False,
                    "running_processes": running_count
                },
                "message": "NetFlow disabled"
            }

    except Exception as e:
        raise Exception(f"Failed to configure NetFlow on FRR: {str(e)}")


def setup_netflow_routes(app, container_manager):
    """Setup NetFlow routes with container_manager dependency"""

    @router.post("/{daemon_name}/netflow")
    def configure_netflow(daemon_name: str, config: NetFlowConfig):
        """Configure NetFlow/IPFIX on a BGP daemon"""
        try:
            # Get daemon info
            daemon_info = container_manager.get_daemon_info(daemon_name)
            if not daemon_info:
                raise HTTPException(status_code=404, detail=f"Daemon '{daemon_name}' not found")

            daemon_type = daemon_info.get("daemon_type", daemon_info.get("type", "")).lower()

            # Configure based on daemon type
            if daemon_type == "gobgp":
                return configure_gobgp_netflow(container_manager, daemon_name, daemon_info, config)
            elif daemon_type == "frr":
                return configure_frr_netflow(container_manager, daemon_name, daemon_info, config)
            else:
                raise HTTPException(status_code=400, detail=f"NetFlow not supported on {daemon_type} daemons")

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to configure NetFlow: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @router.get("/{daemon_name}/netflow")
    def get_netflow_status(daemon_name: str):
        """Get NetFlow configuration status for a daemon"""
        try:
            # Check if softflowd is running
            check_cmd = "ps aux | grep softflowd | grep -v grep"
            result = container_manager.exec_in_container(daemon_name, check_cmd)

            if "softflowd" in result.get("output", ""):
                # Parse softflowd process info to get details
                process_info = result.get("output", "")

                # Extract collector info from process args
                collector = "unknown"
                version = 9
                interface = "unknown"

                # softflowd process typically looks like: softflowd -i eth0 -n host:port -v 9 -d
                collector_match = re.search(r'-n\s+([^\s]+)', process_info)
                if collector_match:
                    collector = collector_match.group(1)

                version_match = re.search(r'-v\s+(\d+)', process_info)
                if version_match:
                    version = int(version_match.group(1))

                interface_match = re.search(r'-i\s+([^\s]+)', process_info)
                if interface_match:
                    interface = interface_match.group(1)

                # Also check softflowctl for statistics if available
                stats_cmd = "softflowctl statistics 2>/dev/null || echo 'N/A'"
                stats_result = container_manager.exec_in_container(daemon_name, stats_cmd)
                stats = stats_result.get("output", "N/A")

                return {
                    "daemon": daemon_name,
                    "netflow": {
                        "enabled": True,
                        "running": True,
                        "collector": collector,
                        "version": version,
                        "interface": interface,
                        "method": "softflowd",
                        "statistics": stats if stats != "N/A" else None
                    }
                }
            else:
                return {
                    "daemon": daemon_name,
                    "netflow": {
                        "enabled": False,
                        "running": False
                    }
                }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    @router.delete("/{daemon_name}/netflow")
    def disable_netflow(daemon_name: str):
        """Disable NetFlow on a daemon"""
        try:
            # Stop softflowd
            stop_cmd = "killall softflowd 2>/dev/null || true"
            container_manager.exec_in_container(daemon_name, stop_cmd)

            # Clean up any softflowd control files
            rm_cmd = "rm -f /var/run/softflowd.* 2>/dev/null || true"
            container_manager.exec_in_container(daemon_name, rm_cmd)

            return {
                "status": "success",
                "daemon": daemon_name,
                "netflow": {
                    "enabled": False
                }
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    return router
