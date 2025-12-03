"""
Pydantic Models for Container Management API
"""
from pydantic import BaseModel
from typing import Optional


class CreateDaemonRequest(BaseModel):
    daemon_type: str  # gobgp, frr, exabgp
    name: str
    asn: int
    router_id: str
    ip_address: Optional[str] = None  # Auto-assign if not provided
    api_port: Optional[int] = None  # Auto-assign if not provided


class CreateHostRequest(BaseModel):
    name: str
    gateway_daemon: str
    gateway_ip: str
    container_ip: Optional[str] = None  # Auto-assign if not provided
    loopback_ip: str
    loopback_network: str = "24"
    network: Optional[str] = "netstream_lab_builder_network"  # Network to connect to
    topology_name: Optional[str] = None  # Topology to associate with (uses active if not provided)


class UpdateDaemonRequest(BaseModel):
    asn: Optional[int] = None
    router_id: Optional[str] = None
    ip_address: Optional[str] = None


class UpdateHostRequest(BaseModel):
    gateway_daemon: Optional[str] = None
    gateway_ip: Optional[str] = None
    loopback_ip: Optional[str] = None
    loopback_network: Optional[str] = None
    container_ip: Optional[str] = None


class ExecCommandRequest(BaseModel):
    command: str


class CreateNetworkRequest(BaseModel):
    name: str
    subnet: str
    gateway: str
    driver: str = "bridge"


class ConnectNetworkRequest(BaseModel):
    ipv4_address: Optional[str] = None


class AddIpToInterfaceRequest(BaseModel):
    ipv4_address: str
    netmask: str = "24"


class NetFlowConfig(BaseModel):
    """NetFlow/IPFIX configuration for BGP daemons"""
    enabled: bool = True
    collector_address: str  # NetFlow collector IP
    collector_port: int = 2055  # Standard NetFlow port
    version: int = 9  # NetFlow version (5, 9, or 10/IPFIX)
    source_address: Optional[str] = None  # Source IP for NetFlow packets
    sampling_rate: Optional[int] = 1  # 1 = no sampling
    active_timeout: Optional[int] = 60  # Active flow timeout in seconds
    inactive_timeout: Optional[int] = 15  # Inactive flow timeout in seconds
    template_refresh_interval: Optional[int] = 600  # Template refresh interval for v9/IPFIX


class ConfigureBMPRequest(BaseModel):
    """Request model for configuring BMP on a daemon"""
    bmp_address: Optional[str] = None  # BMP server address (auto-discovered if not provided)
    bmp_port: int = 11019  # BMP server port
