"""
Abstract BGP Manager Interface

Defines the contract that all BGP backend implementations must follow.
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional
from ..models.bgp import PolicyDefinition


class BGPManager(ABC):
    """
    Abstract base class for BGP backend implementations.

    All BGP backends (GoBGP, FRR, ExaBGP) must implement this interface
    to ensure consistent API across implementations.
    """

    def __init__(self, asn: int, router_id: str):
        """
        Initialize BGP manager.

        Args:
            asn: BGP AS number
            router_id: BGP router ID
        """
        self.asn = asn
        self.router_id = router_id

    # ========================================================================
    # Route Management
    # ========================================================================

    @abstractmethod
    def advertise_route(
        self,
        prefix: str,
        cidr: str,
        **kwargs
    ) -> Dict:
        """
        Advertise a BGP route.

        Args:
            prefix: IP prefix (e.g., '10.0.0.0')
            cidr: CIDR notation (e.g., '24')
            **kwargs: Additional route attributes (next_hop, community, as_path, etc.)

        Returns:
            Status dictionary with success/failure and message
        """
        pass

    @abstractmethod
    def withdraw_route(self, prefix: str, cidr: str) -> Dict:
        """
        Withdraw a BGP route.

        Args:
            prefix: IP prefix
            cidr: CIDR notation

        Returns:
            Status dictionary
        """
        pass

    # ========================================================================
    # Neighbor Management
    # ========================================================================

    @abstractmethod
    def configure_neighbor(
        self,
        ip: str,
        remote_asn: int,
        **kwargs
    ) -> Dict:
        """
        Configure a BGP neighbor.

        Args:
            ip: Neighbor IP address
            remote_asn: Remote AS number
            **kwargs: Additional neighbor attributes (local_asn, description, etc.)

        Returns:
            Status dictionary
        """
        pass

    @abstractmethod
    def delete_neighbor(self, ip: str) -> Dict:
        """
        Delete a BGP neighbor.

        Args:
            ip: Neighbor IP address

        Returns:
            Status dictionary
        """
        pass

    @abstractmethod
    def get_all_neighbors_full_state(self) -> List[Dict]:
        """
        Get all configured neighbors with their full state.

        Returns:
            List of neighbor dictionaries with state information
        """
        pass

    # ========================================================================
    # Policy Management
    # ========================================================================

    @abstractmethod
    def create_or_update_policy(self, name: str, policy: PolicyDefinition) -> Dict:
        """
        Create or update a routing policy.

        Args:
            name: Policy name
            policy: Policy definition

        Returns:
            Status dictionary
        """
        pass

    @abstractmethod
    def delete_policy(self, name: str) -> Dict:
        """
        Delete a routing policy.

        Args:
            name: Policy name

        Returns:
            Status dictionary
        """
        pass

    # ========================================================================
    # Optional Features (with default NotImplementedError)
    # ========================================================================

    def add_flowspec_rule(self, family: str, match: Dict, actions: Dict) -> Dict:
        """
        Add a FlowSpec rule (optional feature).

        Args:
            family: Address family
            match: Match conditions
            actions: Actions to take

        Returns:
            Status dictionary

        Raises:
            NotImplementedError: If backend doesn't support FlowSpec
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} does not support FlowSpec"
        )

    def add_bmp_server(self, address: str, port: int = 11019) -> Dict:
        """
        Add BMP server (optional feature).

        Args:
            address: BMP server address
            port: BMP server port

        Returns:
            Status dictionary

        Raises:
            NotImplementedError: If backend doesn't support BMP
        """
        raise NotImplementedError(
            f"{self.__class__.__name__} does not support BMP"
        )
