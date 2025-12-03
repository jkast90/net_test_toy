# Container Management API

A standalone FastAPI microservice for managing Docker containers, networks, BGP daemons, hosts, and network topologies in the NetStream lab environment.

## Overview

This API provides comprehensive container lifecycle management for the NetStream platform, including:

- **BGP Daemon Management**: Create and manage GoBGP, FRR, and ExaBGP containers
- **Host Management**: Create and manage host containers with network interfaces
- **Network Management**: Manage Docker networks, IP addresses, and interface configurations
- **GRE Tunnel Management**: Create and manage GRE tunnels between containers
- **Topology Management**: Standup and teardown complete network topologies
- **Synchronization**: Sync container state with database

## Architecture

### Modular Design

The API follows a facade pattern with specialized manager modules:

```
api-container/
├── container_api.py          # FastAPI endpoints
├── container_manager.py      # Main facade
├── database.py               # Database operations
├── managers/                 # Specialized managers
│   ├── daemon_manager.py    # BGP daemon operations
│   ├── host_manager.py      # Host container operations
│   ├── network_manager.py   # Network management
│   ├── tunnel_manager.py    # GRE tunnel operations
│   ├── topology_manager.py  # Topology lifecycle
│   ├── sync_manager.py      # Docker-to-DB sync
│   └── utils.py             # Utility functions
└── main.py                  # Entry point
```

## API Endpoints

### Daemon Management
- `GET /daemons` - List all BGP daemons
- `POST /daemons` - Create new BGP daemon
- `DELETE /daemons/{name}` - Delete daemon
- `POST /daemons/{name}/start` - Start daemon
- `POST /daemons/{name}/stop` - Stop daemon

### Host Management
- `GET /hosts` - List all hosts
- `POST /hosts` - Create new host
- `DELETE /hosts/{name}` - Delete host
- `POST /hosts/{name}/exec` - Execute command in host

### Network Management
- `GET /networks` - List all networks
- `POST /networks` - Create network
- `DELETE /networks/{name}` - Delete network
- `POST /networks/connect` - Connect container to network
- `POST /networks/disconnect` - Disconnect container from network

### Tunnel Management
- `GET /tunnels` - List all GRE tunnels
- `POST /tunnels` - Create GRE tunnel
- `DELETE /tunnels/{container}/{tunnel}` - Delete tunnel
- `GET /tunnels/{container}/{tunnel}/state` - Get tunnel state
- `POST /tunnels/{container}/{tunnel}/diagnose` - Diagnose tunnel
- `POST /tunnels/{container}/{tunnel}/fix` - Auto-fix tunnel issues

### Topology Management
- `GET /topologies` - List topologies
- `POST /topologies` - Create topology
- `DELETE /topologies/{id}` - Delete topology
- `POST /topologies/{id}/activate` - Activate topology
- `POST /topology/standup` - Standup topology
- `POST /topology/teardown` - Teardown topology

## Running the API

### With Docker Compose

```bash
docker-compose -f docker-compose.unified.yml up container-manager
```

The API will be available at `http://localhost:5010`

### Standalone

```bash
pip install -r requirements.txt
python main.py
```

## Dependencies

- FastAPI - Web framework
- Uvicorn - ASGI server
- Docker SDK for Python - Container management
- Pydantic - Data validation
- aiohttp/httpx - HTTP client libraries

## Database

Uses SQLite database (`container_manager.db`) to store:
- Daemon configurations
- Host configurations
- Network topologies
- IP address allocations
- Tunnel configurations

## Docker Socket Access

The container requires access to the Docker socket to manage containers:

```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

## Integration

This API is designed to be consumed by:
- NetStream UI (React frontend)
- Other microservices in the NetStream platform
- CLI tools and scripts

## Development

The API runs in development mode with hot-reload enabled for quick iteration.

## Security Notes

- This API requires Docker socket access and should be run in trusted environments
- CORS is configured for development (allows all origins)
- No authentication is currently implemented
