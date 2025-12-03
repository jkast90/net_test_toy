"""
Topology-related data models
"""
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime


class TopologyConfig(BaseModel):
    """Network topology configuration"""
    name: str = Field(..., description="Topology name")
    description: Optional[str] = Field(None, description="Topology description")
    active: bool = Field(False, description="Is topology active")
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
