"""
FRR API Models

This module imports shared models from common_models and can define
FRR-specific models if needed in the future.
"""

# Import all shared models from common_models
from common_models import (
    RouteAttributes,
    NeighborAttributes,
    PolicyTerm,
    PolicyDefinition,
    PrefixListDefinition,
    FlowSpecMatch,
    FlowSpecAction,
    FlowSpecRule,
    BmpServerConfig,
    EventWebhook,
)

# Re-export for backward compatibility
__all__ = [
    "RouteAttributes",
    "NeighborAttributes",
    "PolicyTerm",
    "PolicyDefinition",
    "PrefixListDefinition",
    "FlowSpecMatch",
    "FlowSpecAction",
    "FlowSpecRule",
    "BmpServerConfig",
    "EventWebhook",
]