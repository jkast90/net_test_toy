"""
BGP-related data models
"""
from typing import Optional, List
from pydantic import BaseModel, Field


class RouteAttributes(BaseModel):
    """BGP route attributes"""
    prefix: str = Field(..., description="IP prefix (e.g., '10.0.0.0')")
    cidr: int = Field(..., description="CIDR notation (e.g., 24)")
    next_hop: Optional[str] = Field(None, description="Next hop IP address")
    origin: Optional[str] = Field("IGP", description="BGP origin (IGP, EGP, INCOMPLETE)")
    as_path: Optional[str] = Field(None, description="AS path")
    local_pref: Optional[int] = Field(None, description="Local preference")
    med: Optional[int] = Field(None, description="Multi-exit discriminator")
    community: Optional[str] = Field(None, description="BGP community")
    ext_community: Optional[str] = Field(None, description="Extended community")


class NeighborAttributes(BaseModel):
    """BGP neighbor configuration"""
    ip: str = Field(..., description="Neighbor IP address")
    remote_asn: int = Field(..., description="Remote AS number")
    local_asn: Optional[int] = Field(None, description="Local AS number (defaults to router ASN)")
    description: Optional[str] = Field(None, description="Neighbor description")
    route_reflector_client: bool = Field(False, description="Is route reflector client")
    ebgp_multihop: Optional[int] = Field(None, description="EBGP multihop TTL")
    update_source: Optional[str] = Field(None, description="Update source interface/IP")


class PolicyDefinition(BaseModel):
    """BGP routing policy"""
    name: str = Field(..., description="Policy name")
    statements: List[dict] = Field(default_factory=list, description="Policy statements")
    default_action: str = Field("reject", description="Default action (accept/reject)")


class PrefixListEntry(BaseModel):
    """Prefix list entry"""
    prefix: str
    cidr: int
    action: str = Field("permit", description="permit or deny")
    ge: Optional[int] = Field(None, description="Greater than or equal to")
    le: Optional[int] = Field(None, description="Less than or equal to")


class PrefixListDefinition(BaseModel):
    """Prefix list definition"""
    name: str
    entries: List[PrefixListEntry] = Field(default_factory=list)
