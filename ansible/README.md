# Ansible Playbooks for External Tunnel Endpoints

Configure external devices (like a Raspberry Pi) as GRE tunnel endpoints for netstream topologies.

## Prerequisites

- Ansible installed on your control machine
- SSH access to target hosts
- sudo/root access on target hosts

## Quick Start

```bash
# Configure the Pi as a tunnel endpoint
ansible-playbook -i inventory.yml configure_tunnel_endpoint.yml

# With custom tunnel IPs
ansible-playbook -i inventory.yml configure_tunnel_endpoint.yml \
  -e tunnel_remote_ip=10.0.0.1 \
  -e tunnel_inner_ip=172.31.0.2

# Teardown the tunnel
ansible-playbook -i inventory.yml teardown_tunnel.yml
```

## Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `tunnel_name` | `gre-netstream` | Name of the GRE tunnel interface |
| `tunnel_local_ip` | `10.0.0.2` | Local IP for GRE outer header (Pi's eth0) |
| `tunnel_remote_ip` | `10.0.0.1` | Remote IP for GRE outer header (mini-pc dongle0) |
| `tunnel_inner_ip` | `172.31.0.2` | IP assigned to tunnel interface |
| `tunnel_inner_prefix` | `30` | Subnet prefix for tunnel network |
| `gre_key` | (none) | Optional GRE key for tunnel identification |

## Network Layout

```
┌─────────────────┐         GRE Tunnel          ┌─────────────────┐
│   mini-pc       │      172.31.0.0/30          │  Raspberry Pi   │
│                 │                              │                 │
│  ┌───────────┐  │                              │                 │
│  │ host1     │  │                              │                 │
│  │ container │──┼──────────────────────────────┼─────────────────│
│  │172.31.0.1 │  │     dongle0      eth0        │  172.31.0.2     │
│  └───────────┘  │     10.0.0.1 ── 10.0.0.2     │                 │
│                 │        (physical link)        │                 │
└─────────────────┘                              └─────────────────┘
```
