"""
Container-related data models
"""
from typing import Optional
from pydantic import BaseModel, Field


class DaemonConfig(BaseModel):
    """BGP daemon container configuration"""
    name: str = Field(..., description="Container name")
    daemon_type: str = Field(..., description="Daemon type (gobgp, frr, exabgp)")
    asn: int = Field(..., description="BGP AS number")
    router_id: str = Field(..., description="BGP router ID")
    ip_address: Optional[str] = Field(None, description="Container IP address")
    api_port: Optional[int] = Field(None, description="API port")
    topology_name: str = Field("default", description="Topology name")


class HostConfig(BaseModel):
    """Host container configuration"""
    name: str = Field(..., description="Host name")
    gateway_daemon: str = Field(..., description="Gateway daemon container name")
    gateway_ip: str = Field(..., description="Gateway IP address")
    container_ip: Optional[str] = Field(None, description="Container management IP")
    loopback_ip: str = Field(..., description="Loopback IP address")
    loopback_network: str = Field("24", description="Loopback network mask")
    topology_name: str = Field("default", description="Topology name")
