"""
IP address utilities
"""
import ipaddress
from typing import Optional


def is_valid_ip(ip: str) -> bool:
    """
    Check if string is a valid IP address.

    Args:
        ip: IP address string

    Returns:
        True if valid, False otherwise
    """
    try:
        ipaddress.ip_address(ip)
        return True
    except ValueError:
        return False


def is_valid_cidr(cidr: int) -> bool:
    """
    Check if CIDR notation is valid.

    Args:
        cidr: CIDR value (0-32 for IPv4, 0-128 for IPv6)

    Returns:
        True if valid, False otherwise
    """
    return 0 <= cidr <= 128


def ip_in_network(ip: str, network: str) -> bool:
    """
    Check if IP address is in network.

    Args:
        ip: IP address
        network: Network in CIDR notation (e.g., '10.0.0.0/24')

    Returns:
        True if IP is in network, False otherwise
    """
    try:
        ip_obj = ipaddress.ip_address(ip)
        network_obj = ipaddress.ip_network(network, strict=False)
        return ip_obj in network_obj
    except ValueError:
        return False


def allocate_next_ip(network: str, used_ips: list, skip_first: int = 1) -> Optional[str]:
    """
    Allocate next available IP in network.

    Args:
        network: Network in CIDR notation
        used_ips: List of already allocated IPs
        skip_first: Number of IPs to skip from start (e.g., gateway)

    Returns:
        Next available IP or None if network is full
    """
    try:
        network_obj = ipaddress.ip_network(network, strict=False)
        hosts = list(network_obj.hosts())

        # Skip first N IPs (usually gateway)
        available = hosts[skip_first:]

        for ip in available:
            if str(ip) not in used_ips:
                return str(ip)

        return None
    except (ValueError, IndexError):
        return None
