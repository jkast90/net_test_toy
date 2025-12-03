# Unified BGP API

A single REST API that manages both FRR and GoBGP BGP implementations.

## Features

- **Multi-Backend Support**: Manage both FRR and GoBGP from one API
- **Runtime Backend Selection**: Choose backend per-request via query parameter
- **Unified Interface**: Same endpoints work with both implementations
- **Automatic Failover**: Falls back to available backends
- **Shared Models**: Uses common_models.py for consistency

## Architecture

```
Unified BGP API
    ├── Backend Manager
    │   ├── GoBGP Backend
    │   └── FRR Backend
    └── REST Endpoints
        ├── Routes
        ├── Neighbors
        ├── Policies
        └── Prefix Lists
```

## Environment Variables

```bash
# Default backend to use
DEFAULT_BGP_BACKEND=gobgp  # or "frr"

# GoBGP Configuration
GOBGP_ASN=65003
GOBGP_ROUTER_ID=192.168.70.14
GOBGP_HOST=localhost
GOBGP_PORT=50051

# FRR Configuration
FRR_ASN=65001
FRR_ROUTER_ID=192.168.70.10

# API Port
PORT=5000
```

## Usage

### Start the API

```bash
cd /Users/jeremykast/src/netstream/api-routing
python3 unified_bgp_api.py
```

### Using Default Backend

```bash
# Uses DEFAULT_BGP_BACKEND environment variable
curl http://localhost:5000/neighbor
```

### Selecting Backend Per-Request

```bash
# Use GoBGP
curl "http://localhost:5000/neighbor?backend=gobgp"

# Use FRR
curl "http://localhost:5000/neighbor?backend=frr"
```

### Examples

#### Advertise Route (GoBGP)

```bash
curl -X POST "http://localhost:5000/route/10.1.1.0/24?backend=gobgp" \
  -H "Content-Type: application/json" \
  -d '{
    "next_hop": "192.168.70.14",
    "community": "65003:100",
    "as_path": "65003",
    "med": 50
  }'
```

#### Get Neighbors (FRR)

```bash
curl "http://localhost:5000/neighbor?backend=frr"
```

#### Configure Neighbor (Auto-select)

```bash
curl -X POST "http://localhost:5000/neighbor/192.168.70.10" \
  -H "Content-Type: application/json" \
  -d '{
    "remote_asn": 65001,
    "local_asn": 65003,
    "description": "Peer Router",
    "ebgp_multihop": true
  }'
```

## API Endpoints

### System

- `GET /` - API information and backend status
- `GET /backends` - List available backends and their status
- `GET /status?backend={name}` - Get BGP daemon status

### Routes

- `POST /route/{prefix}/{cidr}?backend={name}` - Advertise route
- `GET /route/{prefix}/{cidr}?backend={name}` - Get route status
- `DELETE /route/{prefix}/{cidr}?backend={name}` - Withdraw route

### Neighbors

- `GET /neighbor?backend={name}` - List all neighbors
- `GET /neighbor/{ip}?backend={name}` - Get neighbor routes
- `POST /neighbor/{ip}?backend={name}` - Configure neighbor
- `POST /neighbor/status/{ip}?backend={name}` - Bring up neighbor
- `DELETE /neighbor/status/{ip}?backend={name}` - Shut down neighbor

### Policies

- `GET /policy?backend={name}` - List policies
- `POST /policy/{name}?backend={name}` - Create/update policy
- `DELETE /policy/{name}?backend={name}` - Delete policy

### Prefix Lists

- `GET /prefix_list?backend={name}` - List prefix lists
- `POST /prefix_list/{name}?backend={name}` - Create/update prefix list
- `DELETE /prefix_list/{name}?backend={name}` - Delete prefix list

### Configuration

- `POST /save?backend={name}` - Save configuration

## Response Format

All responses include the backend that handled the request:

```json
{
  "backend": "gobgp",
  "message": "Advertised route 10.1.1.0/24",
  "applied_attributes": {
    "next_hop": "192.168.70.14",
    "community": "65003:100"
  }
}
```

## Error Handling

If a backend is unavailable:

```json
{
  "detail": "Backend gobgp not available: Connection refused"
}
```

## Benefits

1. **Single API** - One endpoint for all BGP operations
2. **Flexibility** - Choose backend per-request or use defaults
3. **Consistency** - Same interface regardless of backend
4. **Failover** - Automatically detect unavailable backends
5. **Migration** - Easy transition between FRR and GoBGP

## Docker Deployment

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY common_models.py .
COPY api-routing/ ./api-routing/
COPY api-gobgp/ ./api-gobgp/
COPY api-frr/ ./api-frr/

ENV DEFAULT_BGP_BACKEND=gobgp
ENV PORT=5000

CMD ["python3", "api-routing/unified_bgp_api.py"]
```

## Development

The unified API automatically discovers and initializes available backends:

- If GoBGP is not available, FRR-only operations continue
- If FRR is not available, GoBGP-only operations continue
- Backend status visible via `GET /backends`
