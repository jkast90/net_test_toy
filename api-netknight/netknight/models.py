from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field, field_validator


def _empty_to_none(val: str | int | None) -> str | int | None:
    # Convert "" -> None so defaults kick in
    return None if isinstance(val, str) and val.strip() == "" else val

class CurlArgs(BaseModel):
    host: str
    path: str = ""
    interface: str = "eth0"
    count: int = 10
    sleep: float = 0.1


class PingArgs(BaseModel):
    host: str
    count: int = Field(default=5, ge=1, le=100)
    interval: Optional[float] = Field(
        None, ge=0.01, description="Interval between pings in seconds (e.g., 0.2)"
    )
    size: Optional[int] = Field(None, ge=0, description="Packet size in bytes")
    flood: bool = False
    verbose: bool = False

    _norm = field_validator("*")(lambda v, _: _empty_to_none(v))


class TracerouteArgs(BaseModel):
    host: str
    maxHops: Optional[int] = Field(30, ge=1, le=255)

    _norm = field_validator("*")(lambda v, _: _empty_to_none(v))


class StopRequest(BaseModel):
    test_id: str


class HpingArgs(BaseModel):
    host: str
    protocol: Optional[str] = "tcp"
    count: Optional[int] = 5
    flood: Optional[bool] = False
    verbose: Optional[bool] = False
    frag: Optional[bool] = False
    syn: Optional[bool] = False
    rand_source: Optional[bool] = False
    ttl: Optional[int] = None
    interval: Optional[str] = None
    data: Optional[int] = None
    source_port: Optional[int] = None
    dest_port: Optional[int] = None
    payload_size: Optional[int] = None
    firewall_id: Optional[int] = None  # <-- ADD THIS


class IperfArgs(BaseModel):
    server: str
    port: int = Field(5201, ge=1, le=65_535)
    duration: int = Field(10, ge=1, le=3_600)
    protocol: Literal["tcp", "udp"] = "tcp"

    _norm = field_validator("*")(lambda v, _: _empty_to_none(v))


class HttpServerArgs(BaseModel):
    """Arguments for starting a Python HTTP server"""
    port: int = Field(8080, ge=1, le=65_535)
    bind: Optional[str] = Field(None, description="Address to bind to (default: all interfaces)")
    directory: str = Field("/tmp", description="Directory to serve files from")

    _norm = field_validator("*")(lambda v, _: _empty_to_none(v))
