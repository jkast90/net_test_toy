"""
BGP-related exceptions
"""


class BGPError(Exception):
    """Base exception for BGP-related errors"""
    pass


class RouteError(BGPError):
    """Exception for route-related errors"""
    pass


class NeighborError(BGPError):
    """Exception for neighbor-related errors"""
    pass


class PolicyError(BGPError):
    """Exception for policy-related errors"""
    pass


class FlowSpecError(BGPError):
    """Exception for FlowSpec-related errors"""
    pass
