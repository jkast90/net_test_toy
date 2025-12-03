"""
Network-related data models
"""
from typing import Optional, List
from pydantic import BaseModel, Field


class NetworkConfig(BaseModel):
    """Docker network configuration"""
    name: str = Field(..., description="Network name")
    subnet: str = Field(..., description="Network subnet (e.g., '10.0.0.0/24')")
    gateway: str = Field(..., description="Gateway IP address")
    driver: str = Field("bridge", description="Network driver")
    topology_name: str = Field("default", description="Topology name")


class InterfaceConfig(BaseModel):
    """Network interface configuration"""
    name: str = Field(..., description="Interface name")
    ip_address: str = Field(..., description="IP address with CIDR")
    mtu: int = Field(1500, description="MTU size")
    state: str = Field("up", description="Interface state (up/down)")


class TunnelConfig(BaseModel):
    """GRE tunnel configuration"""
    container_name: str = Field(..., description="Container name")
    tunnel_name: str = Field(..., description="Tunnel interface name")
    local_ip: str = Field(..., description="Local endpoint IP")
    remote_ip: str = Field(..., description="Remote endpoint IP")
    tunnel_ip: str = Field(..., description="Tunnel interface IP")
    tunnel_network: str = Field("30", description="Tunnel network mask")
    gre_key: Optional[int] = Field(None, description="GRE key")
    ttl: int = Field(64, description="TTL value")
    topology_name: str = Field("default", description="Topology name")
