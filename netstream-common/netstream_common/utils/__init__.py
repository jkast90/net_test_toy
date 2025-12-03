"""
Utility functions for NetStream services
"""

from .ip import (
    allocate_next_ip,
    is_valid_ip,
    is_valid_cidr,
    ip_in_network,
)

__all__ = [
    "allocate_next_ip",
    "is_valid_ip",
    "is_valid_cidr",
    "ip_in_network",
]
