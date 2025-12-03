"""
Common BGP API Models

This module provides shared Pydantic models used by both GoBGP and FRR REST APIs.
By centralizing these models, we ensure consistent API signatures across implementations.
"""

from typing import Optional, List
from pydantic import BaseModel, Field


# ============================================================================
# Route Management Models
# ============================================================================

class RouteAttributes(BaseModel):
    """
    BGP route attributes for route advertisement and modification.

    All fields are optional to allow flexible route configuration.
    """
    next_hop: Optional[str] = Field(
        None,
        description="Next-hop IP address for the route"
    )
    community: Optional[str] = Field(
        None,
        description="BGP communities (format: '123:456 789:012')",
        examples=["65000:100", "65000:100 65000:200"]
    )
    extended_community: Optional[str] = Field(
        None,
        description="Extended communities (format: 'rt 123:456' or 'soo 123:456')",
        examples=["rt 65000:100", "soo 65000:200"]
    )
    as_path: Optional[str] = Field(
        None,
        description="AS-path prepend (format: '65001 65002')",
        examples=["65001", "65001 65002 65003"]
    )
    med: Optional[int] = Field(
        None,
        description="Multi-Exit Discriminator (MED) value",
        ge=0
    )


# ============================================================================
# Neighbor Management Models
# ============================================================================

class NeighborAttributes(BaseModel):
    """
    BGP neighbor configuration attributes.

    Supports both IBGP and EBGP configurations with optional policies,
    multihop, and authentication.
    """
    remote_asn: int = Field(
        ...,
        description="Remote AS number",
        ge=1,
        le=4294967295
    )
    local_asn: int = Field(
        ...,
        description="Local AS number",
        ge=1,
        le=4294967295
    )
    out_policy: Optional[str] = Field(
        None,
        description="Outbound route-map/policy name"
    )
    in_policy: Optional[str] = Field(
        None,
        description="Inbound route-map/policy name"
    )
    description: Optional[str] = Field(
        "",
        description="Human-readable neighbor description"
    )
    local_address: Optional[str] = Field(
        None,
        description="Local IP address for BGP session (update-source)"
    )
    ebgp_multihop: Optional[bool] = Field(
        True,
        description="Enable EBGP multihop (for non-directly connected EBGP peers)"
    )
    ebgp_multihop_ttl: Optional[int] = Field(
        255,
        description="EBGP multihop TTL value",
        ge=1,
        le=255
    )
    auth_password: Optional[str] = Field(
        None,
        description="MD5 authentication password for BGP session"
    )
    next_hop_self: Optional[bool] = Field(
        False,
        description="Set next-hop to self for routes advertised to this neighbor"
    )


# ============================================================================
# Policy Management Models
# ============================================================================

class PolicyTerm(BaseModel):
    """
    Individual term/statement within a BGP policy.

    Each term can match on AS-path or prefix-list and set attributes.
    """
    seq: int = Field(
        ...,
        description="Sequence number for term ordering",
        ge=1
    )
    match_as_path: Optional[str] = Field(
        None,
        description="AS-path filter to match"
    )
    match_prefix_list: Optional[str] = Field(
        None,
        description="Prefix-list name to match"
    )
    set_community: Optional[str] = Field(
        None,
        description="Community to set on matched routes"
    )
    set_ext_community: Optional[str] = Field(
        None,
        description="Extended community to set on matched routes"
    )
    on_match_next: Optional[bool] = Field(
        False,
        description="Continue to next term on match (vs exit policy)"
    )


class PolicyDefinition(BaseModel):
    """
    Complete BGP policy definition consisting of one or more terms.
    """
    terms: List[PolicyTerm] = Field(
        ...,
        description="List of policy terms to evaluate in sequence"
    )


class PrefixListDefinition(BaseModel):
    """
    Prefix-list definition for route filtering.
    """
    prefixes: List[str] = Field(
        ...,
        description="List of CIDR prefixes to match",
        examples=[["1.1.1.0/24", "2.2.2.0/24"]]
    )


# ============================================================================
# FlowSpec Models (Traffic Filtering)
# ============================================================================

class FlowSpecMatch(BaseModel):
    """
    FlowSpec match conditions for traffic filtering.

    Supports matching on various packet attributes including:
    - IP source/destination
    - Protocol and ports
    - ICMP type/code
    - Packet length and DSCP
    """
    destination: Optional[str] = Field(
        None,
        description="Destination CIDR prefix (e.g., '192.0.2.0/24')"
    )
    source: Optional[str] = Field(
        None,
        description="Source CIDR prefix"
    )
    protocol: Optional[int] = Field(
        None,
        description="IP protocol number (6=TCP, 17=UDP, 1=ICMP)",
        ge=0,
        le=255
    )
    port: Optional[int] = Field(
        None,
        description="Match any port (source or destination)",
        ge=0,
        le=65535
    )
    destination_port: Optional[int] = Field(
        None,
        description="Destination port",
        ge=0,
        le=65535
    )
    source_port: Optional[int] = Field(
        None,
        description="Source port",
        ge=0,
        le=65535
    )
    icmp_type: Optional[int] = Field(
        None,
        description="ICMP type",
        ge=0,
        le=255
    )
    icmp_code: Optional[int] = Field(
        None,
        description="ICMP code",
        ge=0,
        le=255
    )
    packet_length: Optional[int] = Field(
        None,
        description="Packet length in bytes",
        ge=0
    )
    dscp: Optional[int] = Field(
        None,
        description="DSCP value",
        ge=0,
        le=63
    )


class FlowSpecAction(BaseModel):
    """
    FlowSpec actions to apply to matched traffic.

    Supported actions:
    - accept: Allow traffic
    - discard: Drop traffic
    - rate-limit: Police traffic to specified rate
    - redirect: Redirect via route target to VRF
    """
    action: str = Field(
        ...,
        description="Action type",
        pattern="^(accept|discard|rate-limit|redirect)$"
    )
    rate: Optional[float] = Field(
        None,
        description="Rate limit in Mbps (for rate-limit action)",
        ge=0
    )
    rate_asn: Optional[int] = Field(
        None,
        description="ASN for rate-limit (optional)",
        ge=0,
        le=4294967295
    )
    redirect_rt: Optional[str] = Field(
        None,
        description="Route Target for redirect (e.g., '65000:100')",
        examples=["65000:100"]
    )
    sample: Optional[bool] = Field(
        False,
        description="Enable traffic sampling"
    )


class FlowSpecRule(BaseModel):
    """
    Complete FlowSpec rule combining match conditions and actions.
    """
    family: Optional[str] = Field(
        "ipv4",
        description="Address family",
        pattern="^(ipv4|ipv6)$"
    )
    match: FlowSpecMatch = Field(
        ...,
        description="Traffic match conditions"
    )
    actions: FlowSpecAction = Field(
        ...,
        description="Actions to apply to matched traffic"
    )


# ============================================================================
# BMP (BGP Monitoring Protocol) Models
# ============================================================================

class BmpServerConfig(BaseModel):
    """
    BMP (BGP Monitoring Protocol) server configuration.

    BMP provides real-time BGP monitoring and route visibility for:
    - Route monitoring (pre-policy, post-policy, local-rib)
    - Statistics collection
    - Route mirroring for debugging
    """
    address: str = Field(
        ...,
        description="BMP server IP address"
    )
    port: Optional[int] = Field(
        11019,
        description="BMP server port",
        ge=1,
        le=65535
    )
    route_monitoring_policy: Optional[str] = Field(
        "pre-policy",
        description="Route monitoring mode",
        pattern="^(pre-policy|post-policy|local-rib|all)$"
    )
    statistics_timeout: Optional[int] = Field(
        0,
        description="Statistics reporting interval in seconds (0=disabled)",
        ge=0,
        le=65535
    )
    route_mirroring_enabled: Optional[bool] = Field(
        False,
        description="Enable route mirroring for debugging"
    )


class NetFlowConfig(BaseModel):
    """
    NetFlow/IPFIX collector configuration.

    Configures BGP daemons to export NetFlow/IPFIX data to a collector.
    This is primarily supported by FRR bgpd via flowspec and route table exports.
    """
    address: str = Field(
        ...,
        description="NetFlow collector IP address"
    )
    port: Optional[int] = Field(
        2055,
        description="NetFlow collector port (default 2055 for IPFIX)",
        ge=1,
        le=65535
    )
    version: Optional[int] = Field(
        10,
        description="NetFlow version (5, 9, or 10 for IPFIX)",
        ge=5,
        le=10
    )
    source_id: Optional[int] = Field(
        None,
        description="Source ID for NetFlow exports",
        ge=0
    )


# ============================================================================
# Event Webhook Models (Event-Driven Routing)
# ============================================================================

class EventWebhook(BaseModel):
    """
    Webhook configuration for BGP event notifications.

    Enables event-driven routing decisions by POSTing BGP events
    (peer up/down, route changes) to external endpoints.
    """
    url: str = Field(
        ...,
        description="Webhook URL to POST events to"
    )
    events: Optional[List[str]] = Field(
        ["peer", "table"],
        description="Event types to monitor: 'peer' (neighbor events), 'table' (route changes)"
    )
    peer_filter: Optional[str] = Field(
        None,
        description="Filter events for specific peer IP address"
    )
    enabled: Optional[bool] = Field(
        True,
        description="Enable or disable this webhook"
    )
