# net_test_toy

A network simulation and BGP lab environment for building, testing, and visualizing network topologies with real routing protocols.

## Features

- **Multi-daemon BGP Support**: GoBGP, FRR, and ExaBGP containers
- **Visual Topology Builder**: Drag-and-drop network design with real-time updates
- **GRE Tunnels**: Point-to-point tunnels between containers
- **NetFlow Collection**: Traffic flow monitoring and visualization
- **External Connectivity**: Connect lab networks to physical interfaces via macvlan

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for UI development)
- Python 3.10+ (for API development)

## Quick Start

### Option A: One-Command Setup (Recommended)

```bash
make setup
```

This builds all images, creates the network, and starts all services.

### Option B: Step-by-Step

#### 1. Build Base Images

```bash
make build-base
```

This builds the foundational container images (python-base, bullseye-base).

#### 2. Build Application Images

```bash
make build-images
```

This builds the unified daemon images (FRR, GoBGP, ExaBGP) and host images.

#### 3. Start the Stack

```bash
make up
# or: docker compose up -d
```

#### 4. Access the UI

Open http://localhost:3000 in your browser.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser UI                           │
│                    (React + TypeScript)                     │
│                      localhost:3000                         │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────────┐  ┌─────────────────────────────┐
│   Container Manager API     │  │      Monitoring API         │
│     (FastAPI + Python)      │  │        (Python)             │
│       localhost:5010        │  │      localhost:5002         │
│  - Topology management      │  │  - BMP Server (:11019)      │
│  - Container orchestration  │  │  - NetFlow Collector (:2055)│
│  - BGP session management   │  │  - Route monitoring         │
└─────────────────────────────┘  └─────────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
   │   GoBGP     │     │    FRR      │     │   ExaBGP    │
   │  Container  │◄───►│  Container  │◄───►│  Container  │
   │  (AS 65001) │     │  (AS 65002) │     │  (AS 65003) │
   └─────────────┘     └─────────────┘     └─────────────┘
         │                   │                   │
         └───────────────────┴───────────────────┘
                    Docker Networks
```

## API Endpoints

### Topologies

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/topologies` | List all topologies |
| POST | `/topologies/{name}` | Create a topology |
| POST | `/topologies/{name}/activate` | Activate and deploy a topology |
| GET | `/topologies/{name}/details` | Get topology details |

### Daemons

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/daemons` | List all BGP daemons |
| POST | `/daemons` | Create a new daemon |
| GET | `/daemons/{name}/status` | Get daemon status |

### BGP Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/topologies/{name}/bgp/sessions` | Create BGP session |
| GET | `/topologies/{name}/bgp/sessions` | List BGP sessions |
| DELETE | `/topologies/{name}/bgp/sessions/{id}` | Delete BGP session |

### Networks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/topologies/{name}/networks` | Create a network |
| POST | `/topologies/{name}/external_networks` | Create external network (macvlan) |
| DELETE | `/topologies/{name}/networks/{network}` | Delete a network |

### GRE Tunnels

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/topologies/{name}/gre/links` | Create GRE link |
| GET | `/topologies/{name}/gre/links` | List GRE links |
| DELETE | `/topologies/{name}/gre/links/{id}` | Delete GRE link |

### Monitoring API (localhost:5002)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API status and info |
| GET | `/bmp/peers` | List BMP peers |
| GET | `/bmp/routes` | Get BGP routes from BMP |
| GET | `/netflow/flows` | Get collected NetFlow data |

**Ports:**
- `5002` - Monitoring REST API
- `11019` - BMP Server (TCP) - point BGP daemons here for route monitoring
- `2055/udp` - NetFlow Collector - send NetFlow/IPFIX data here

## Creating a Lab

### Via UI

1. Navigate to the Topology Builder page
2. Click "Add Daemon" to create BGP routers
3. Click "Add Network" to create interconnecting networks
4. Connect daemons to networks
5. Create BGP sessions between daemons
6. Click "Activate" to deploy

### Via API

```bash
# Create a topology
curl -X POST "http://localhost:5010/topologies/mylab"

# Create a network
curl -X POST "http://localhost:5010/topologies/mylab/networks?name=transit&subnet=10.0.1.0/24&gateway=10.0.1.1"

# Create daemons
curl -X POST "http://localhost:5010/daemons" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "router1",
    "daemon_type": "gobgp",
    "asn": 65001,
    "router_id": "1.1.1.1"
  }'

# Create BGP session
curl -X POST "http://localhost:5010/topologies/mylab/bgp/sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "daemon1": "router1",
    "daemon1_ip": "10.0.1.2",
    "daemon1_asn": 65001,
    "daemon2": "router2",
    "daemon2_ip": "10.0.1.3",
    "daemon2_asn": 65002
  }'

# Activate the topology
curl -X POST "http://localhost:5010/topologies/mylab/activate"
```

## External Networks (macvlan)

Connect containers to your physical network:

```bash
# Linux only - requires physical interface access
curl -X POST "http://localhost:5010/topologies/default/external_networks" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "external-lan",
    "subnet": "192.168.1.0/24",
    "gateway": "192.168.1.1",
    "driver": "macvlan",
    "parent_interface": "eth0"
  }'
```

> Note: macvlan networks only work on Linux hosts with direct access to physical interfaces. On macOS (Docker Desktop), use bridge networks instead.

## Development

### UI Development

```bash
cd ui-net-test-toy/ui
npm install
npm run dev
```

### API Development

The container-manager mounts the local `api-container` directory, so changes are reflected immediately with hot-reload.

### Building Individual Images

```bash
# Build a base image
docker build -t python-base -f docker_base/python-base/dockerfile docker_base/python-base/

# Build a unified daemon image (from project root)
docker build -t gobgp-unified -f docker_base/gobgp-unified/dockerfile .
```

## Troubleshooting

### Container won't stop (permission denied)

On Linux with AppArmor:
```bash
sudo systemctl stop docker
sudo rm -rf /var/lib/docker/containers/<container-id>
sudo systemctl start docker
```

### Network creation fails

Check for conflicting subnets:
```bash
docker network ls
docker network inspect <network-name>
```

### BGP session not establishing

1. Check container connectivity:
   ```bash
   docker exec router1 ping <peer-ip>
   ```

2. Check BGP daemon logs:
   ```bash
   docker logs router1
   ```

3. Verify BGP configuration:
   ```bash
   # GoBGP
   docker exec router1 gobgp neighbor

   # FRR
   docker exec router1 vtysh -c "show bgp summary"
   ```

## License

MIT
