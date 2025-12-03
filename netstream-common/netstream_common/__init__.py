"""
NetStream Common Library

Shared models, interfaces, and utilities for NetStream microservices.
"""

__version__ = "0.1.0"

# Re-export commonly used items for convenience
from .models.bgp import RouteAttributes, NeighborAttributes
from .models.container import DaemonConfig, HostConfig
from .models.network import NetworkConfig, InterfaceConfig

__all__ = [
    "RouteAttributes",
    "NeighborAttributes",
    "DaemonConfig",
    "HostConfig",
    "NetworkConfig",
    "InterfaceConfig",
]
