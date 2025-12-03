"""
Container and infrastructure-related exceptions
"""


class ContainerError(Exception):
    """Base exception for container-related errors"""
    pass


class NetworkError(ContainerError):
    """Exception for network-related errors"""
    pass


class TunnelError(ContainerError):
    """Exception for GRE tunnel-related errors"""
    pass


class TopologyError(ContainerError):
    """Exception for topology-related errors"""
    pass
