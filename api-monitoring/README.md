# Monitoring API

Provides BGP monitoring and network telemetry collection for the NetStream platform.

## Services

### BMP Server (BGP Monitoring Protocol)
- **Port**: 11019
- **Protocol**: TCP
- **Purpose**: Receives BGP monitoring messages from routers
- **Supports**: Route updates, peer status, statistics

### NetFlow Collector
- **Port**: 2055
- **Protocol**: UDP
- **Purpose**: Collects network flow data
- **Supports**: NetFlow v5/v9, IPFIX

## Running

### With Docker Compose

```bash
docker-compose -f docker-compose.unified.yml up monitoring
```

### Standalone

```bash
pip install -r requirements.txt
python main.py
```

## Environment Variables

- `BMP_BIND_ADDRESS` - BMP server bind address (default: 0.0.0.0)
- `BMP_PORT` - BMP server port (default: 11019)
- `NETFLOW_PORT` - NetFlow collector port (default: 2055)

## Architecture

The monitoring service runs both BMP and NetFlow collectors in parallel using multiprocessing:

```
api-monitoring/
├── main.py                  # Entry point (multiprocessing coordinator)
├── bmp_server.py           # BMP protocol implementation
├── netflow_collector.py    # NetFlow/IPFIX collector
├── Dockerfile
└── requirements.txt
```

## Integration

This service is consumed by:
- NetStream UI (real-time BGP monitoring)
- NetFlow analysis tools
- External monitoring systems

## Dependencies

- Python 3.11+
- FastAPI (for potential REST API endpoints)
- aiohttp/httpx (for async HTTP)
- Standard library networking modules

## Development

The service runs in development mode with hot-reload disabled (multiprocessing doesn't support it well).

## Logs

Both services log to stdout/stderr. Use Docker logs to view:

```bash
docker logs -f monitoring
```
