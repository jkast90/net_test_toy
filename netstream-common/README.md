# NetStream Common

Shared library for NetStream platform microservices.

## Overview

This package provides common code shared across NetStream services:
- **Models**: Pydantic models for BGP, containers, networks, topologies
- **Interfaces**: Abstract base classes for managers
- **Exceptions**: Custom exception classes
- **Utils**: Utility functions for IP allocation, validation, etc.

## Installation

```bash
pip install netstream-common
```

Or for development:

```bash
pip install -e ./netstream-common
```

## Usage

```python
from netstream_common.models import RouteAttributes, DaemonConfig
from netstream_common.interfaces import BGPManager
from netstream_common.utils import allocate_next_ip

# Use shared models
route = RouteAttributes(
    prefix="10.0.0.0",
    cidr=24,
    next_hop="192.168.1.1"
)

# Implement interfaces
class MyBGPManager(BGPManager):
    def advertise_route(self, route: RouteAttributes):
        ...
```

## Package Structure

```
netstream_common/
├── models/
│   ├── bgp.py           # BGP route, neighbor, policy models
│   ├── container.py     # Daemon, host models
│   ├── network.py       # Network, interface models
│   └── topology.py      # Topology models
├── interfaces/
│   ├── bgp_manager.py   # Abstract BGP manager interface
│   └── container_manager.py  # Abstract container manager interface
├── exceptions/
│   ├── bgp.py           # BGP-related exceptions
│   └── container.py     # Container-related exceptions
└── utils/
    ├── ip.py            # IP allocation and validation
    ├── validation.py    # Data validation helpers
    └── formatting.py    # Output formatting utilities
```

## Development

### Running Tests

```bash
pytest tests/
```

### Building

```bash
python -m build
```

### Publishing (for maintainers)

```bash
python -m twine upload dist/*
```

## License

MIT
