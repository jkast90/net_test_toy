from functools import lru_cache
import ipaddress
import json
import logging
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional, List, Dict

from fastapi import HTTPException

from ..common.models import PolicyDefinition, PrefixListDefinition

# Add netstream-common to path if running locally
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "netstream-common"))

try:
    from netstream_common.interfaces import BGPManager as BGPManagerInterface
except ImportError:
    # Fallback if netstream-common not installed
    BGPManagerInterface = object

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("uvicorn.error")

class FRRManager(BGPManagerInterface):
    def __init__(self, asn: int, router_id: str, iface: str = "eth0", prefix_list: str = "OUT"):
        self.asn = asn
        self.router_id = router_id
        self.iface = iface
        self.prefix_list = prefix_list

    def save_config(self) -> str:
        """Save the current FRR configuration to disk"""
        return self._run("write")

    def _run(self, command: str) -> str:
        try:
            output = subprocess.check_output(["vtysh", "-c", command], stderr=subprocess.STDOUT, text=True)
            if "json" in command:
                try:
                    # Extract JSON from output (skip any warning messages before the JSON)
                    # Look for JSON starting on a new line (after warnings)
                    lines = output.split('\n')
                    json_lines = []
                    found_json_start = False

                    for line in lines:
                        # Skip empty lines and lines that look like warnings/errors
                        if not line.strip():
                            continue
                        if line.strip().startswith('%') or line.strip().startswith('Configuration'):
                            continue
                        # Found start of JSON
                        if line.strip().startswith('{') or line.strip().startswith('['):
                            found_json_start = True
                        if found_json_start:
                            json_lines.append(line)

                    if json_lines:
                        json_text = '\n'.join(json_lines)
                        output = json.loads(json_text)
                    else:
                        # Fallback: try parsing the whole thing
                        output = json.loads(output)
                except Exception as e:
                    logger.warning(f"[FRR] Failed to parse JSON from vtysh output: {e}. Output was: {output[:200]}")
                    pass
            return output
        except subprocess.CalledProcessError as e:
            raise HTTPException(status_code=500, detail=f"Command failed: {e.output.strip()}")

    def _configure(self, config_lines: list[str]) -> str:
        """Run a block of configuration lines in config mode"""
        full = ["conf t"] + config_lines + ["end"]
        return self._run("\n".join(full))

    def advertise_route(
        self,
        prefix: str,
        cidr: str,
        *,
        next_hop:     Optional[str] = None,
        community:     Optional[str] = None,   # "65000:1 65000:2"
        ext_community: Optional[str] = None,  # "rt 65000:1 soo 65000:2"
    ) -> None:
        """
        • Installs a static route to *prefix/cidr* (via next_hop or Null0)  
        • Adds the prefix to **ip prefix-list OUT**  
        • For **every** community / ext-community token a *separate*
          ``route-map ADD_COMMS permit <seq>`` stanza is created.

        Example produced config
        -----------------------
        ip route 198.19.0.0/20 Null0
        ip prefix-list OUT seq 10 permit 198.19.0.0/20
        route-map ADD_COMMS permit 20
          match ip address prefix-list OUT
          set community 6555:6666 additive
        route-map ADD_COMMS permit 25
          match ip address prefix-list OUT
          set community 6555:7777 additive
        route-map ADD_COMMS permit 30
          match ip address prefix-list OUT
          set extcommunity rt 65000:42 additive
        """
        net        = f"{prefix}/{cidr}"
        pfx_name   = prefix.replace(".", "_")       # e.g. 198_19_0_0
        rmap_name  = "ADD_COMMS"

        pfx_seq_base  = self._next_seq(rf"^ip prefix-list {re.escape(pfx_name)} +seq +(\\d+) ")
        rmap_seq_base = self._next_seq(rf"^route-map {re.escape(rmap_name)} +permit +(\\d+)")

        cfg: list[str] = [
            f"ip route {net} {next_hop or 'Null0'}",
            f"ip prefix-list {pfx_name} seq {pfx_seq_base} permit {net}",
        ]

        seq = rmap_seq_base
        for comm in _split_list(community):
            cfg.extend((
                f"route-map {rmap_name} permit {seq}",
                f" match ip address prefix-list {pfx_name}",
                f" set community {comm} additive",
                f" continue",
            ))
            seq += 5  # keep things tidy (…,20,25,30,…)

        for xcomm in _split_list(ext_community):
            cfg.extend((
                f"route-map {rmap_name} permit {seq}",
                f" match ip address prefix-list {pfx_name}",
                f" set extcommunity {xcomm} additive",
                f" continue",
            ))
            seq += 5

        if community == "" and ext_community == "":
            cfg.extend((
                f"route-map {rmap_name} permit {seq}",
                f" match ip address prefix-list {pfx_name}",
                f" on-match next",
            ))
            seq += 5


        # -----------------------------------------------------------------
        # 3) BGP section - ensure redistribute static is enabled and add network statement
        # The network statement directly advertises the prefix into BGP, which works
        # even for connected networks where the static blackhole route doesn't install
        # -----------------------------------------------------------------
        cfg.extend((
            f"router bgp {self.asn}",
            f" address-family ipv4 unicast",
            f"  redistribute static",
            f"  network {net}",
        ))
        logger.info(cfg)

        self._configure(cfg)
        logger.info(
            "[FRR] Advertised %s  comm=%s  ext=%s  next-hop=%s",
            net, community, ext_community, next_hop or "self",
        )
        self.save_config()
        self.clear_bgp_soft()

    def withdraw_route(self, prefix: str, cidr: str):
        pfx_name   = prefix.replace(".", "_")       # e.g. 198_19_0_0
        iface = self._detect_iface(prefix)
        logger.info(iface)
        config = [
            f"no ip route {prefix}/{cidr} {iface}",
            f"router bgp {self.asn}",
            f"address-family ipv4 unicast",
            f"no ip prefix-list {pfx_name}",
        ]
        self._configure(config)
        self.save_config()
        self.clear_bgp_soft()

    def get_route_status(self, prefix: str, cidr: str) -> str:
        return self._run(f"show bgp ipv4 unicast {prefix}/{cidr} json")

    def get_neighbor_routes(self, ip: str) -> dict:
        neighbor_routes = {
            "received_routes": self.get_neighbor_received_routes(ip),
            "advertised_routes": self.get_neighbor_advertised_routes(ip),
        }
        return neighbor_routes

    def get_neighbor_advertised_routes(self, ip):
        output = self._run(f"show ip bgp neighbors {ip} advertised-routes json")
        parsed = self.parse_neighbor_routes(output)
        return parsed
    
    def get_neighbor_received_routes(self, ip):
        output = self._run(f"show ip bgp neighbors {ip} received-routes json")
        parsed = self.parse_neighbor_routes(output)
        return parsed

    def bring_up_neighbor(self, ip: str, remote_as: int):
        config = [
            f"router bgp {self.asn}",
            f"neighbor {ip} remote-as {remote_as}",
            f"no neighbor {ip} shutdown",
        ]
        self._configure(config)

    def configure_neighbor(
        self,
        ip: str,
        remote_as: int,
        local_as: int,
        description: str,
        out_policy: Optional[str] = None,
        in_policy: Optional[str] = None,
        local_address: Optional[str] = None,
        ebgp_multihop: Optional[bool] = True,
        ebgp_multihop_ttl: Optional[int] = 255,
        auth_password: Optional[str] = None,
        next_hop_self: Optional[bool] = None,
    ):
        update_source = local_address or self.router_id
        config = [
            f"router bgp {local_as}",
            f"neighbor {ip} remote-as {remote_as}",
            f"neighbor {ip} description \"{description}\"",
            f"neighbor {ip} update-source {update_source}",
            f"neighbor {ip} graceful-restart",
        ]

        # Add EBGP multihop if enabled
        if ebgp_multihop and remote_as != local_as:
            config.append(f"neighbor {ip} ebgp-multihop {ebgp_multihop_ttl}")

        # Add authentication if provided
        if auth_password:
            config.append(f"neighbor {ip} password {auth_password}")

        # AFI configuration - IPv4 Unicast
        config.append(f"address-family ipv4 unicast")
        config.append(f"neighbor {ip} activate")
        config.append(f"neighbor {ip} soft-reconfiguration inbound")

        # Add next-hop-self if enabled
        if next_hop_self:
            config.append(f"neighbor {ip} next-hop-self")

        # Add policies if provided
        if in_policy:
            config.append(f"neighbor {ip} prefix-list {in_policy} in")
        if out_policy:
            config.append(f"neighbor {ip} route-map {out_policy} out")

        config.append(f"exit-address-family")

        # AFI configuration - IPv4 FlowSpec (always enabled for all peers)
        config.append(f"address-family ipv4 flowspec")
        config.append(f"neighbor {ip} activate")
        config.append(f"exit-address-family")

        self._configure(config)

    def shut_down_neighbor(self, ip: str):
        config = [
            f"router bgp {self.asn}",
            f"neighbor {ip} shutdown",
        ]
        self._configure(config)

    def delete_neighbor(self, ip: str):
        """
        Delete a BGP neighbor completely.
        """
        config = [
            f"router bgp {self.asn}",
            f"no neighbor {ip}",
        ]
        self._configure(config)
       
    def create_or_update_policy(self, name: str, policy: PolicyDefinition):
        cfg = []
        for term in policy.terms:
            cfg.append(f"route-map {name} permit {term.seq}")
            if term.match_as_path:
                cfg.append(f" match as-path {term.match_as_path}")
            if term.match_prefix_list:
                cfg.append(f" match ip address prefix-list {term.match_prefix_list}")
            if term.set_community:
                cfg.append(f" set community {term.set_community} additive")
            if term.set_ext_community:
                cfg.append(f" set extcommunity {term.set_ext_community} additive")
            if term.on_match_next:
                cfg.append(" on-match next")
        self._configure(cfg)
        self.save_config()
        
    def get_all_neighbors_full_state(self) -> list[dict]:
        try:
            summary = self._run("show ip bgp neighbors json")
        except Exception:
            logger.exception("[FRR] Failed to get BGP neighbor summary")
            return []

        neighbors = []
        for neighbor_ip, data in summary.items():
            try:
                routes = self.get_neighbor_routes(neighbor_ip)
                advertised_routes = routes["advertised_routes"]
                received_routes = routes["received_routes"]  
            except Exception as err:
                logger.warning(f"[FRR] Failed to get routes for neighbor {neighbor_ip}: {err}")
                advertised_routes = []
                received_routes = []

            families = {}
            for fam, fam_info in data.get("addressFamilyInfo", {}).items():
                in_name  = fam_info.get("incomingUpdatePrefixFilterList")
                out_name = fam_info.get("outgoingUpdatePrefixFilterList")

                families[fam] = {
                    "in_list":           in_name,
                    "in_list_entries":   self._get_prefix_list_entries(in_name),
                    "out_list":          out_name,
                    "out_list_entries":  self._get_prefix_list_entries(out_name),
                    "accepted":          fam_info.get("acceptedPrefixCounter"),
                    "sent":              fam_info.get("sentPrefixCounter"),
                }

            msg_stats = data.get("messageStats", {})

            # Convert uptime from milliseconds to seconds and format
            from ..common.utils import format_uptime
            uptime_msec = data.get("bgpTimerUpMsec", 0)
            uptime_sec = uptime_msec // 1000  # Convert milliseconds to seconds
            uptime_formatted = format_uptime(uptime_sec) if uptime_sec > 0 else "N/A"

            neighbors.append({
                "neighbor_ip": neighbor_ip,
                "remote_as": data.get("remoteAs"),
                "local_as": data.get("localAs"),
                "state": data.get("bgpState"),
                "admin_shutdown": data.get("adminShutDown", False),
                "description": data.get("nbrDesc"),
                "hostname": data.get("hostname"),
                "local_router_id": data.get("localRouterId"),
                "remote_router_id": data.get("remoteRouterId"),
                "uptime": uptime_sec,
                "uptime_str": uptime_formatted,
                "established_epoch": data.get("bgpTimerUpEstablishedEpoch"),
                "msg_sent": msg_stats.get("totalSent"),
                "msg_rcvd": msg_stats.get("totalRecv"),
                "updates_sent": msg_stats.get("updatesSent"),
                "updates_rcvd": msg_stats.get("updatesRecv"),
                "update_source": data.get("updateSource"),
                "families": families,
                "advertised_routes": advertised_routes,
                "received_routes": received_routes,
            })

        logger.info(f"[FRR] Parsed {len(neighbors)} BGP neighbors")
        return neighbors

    def delete_policy(self, name: str):
        self._configure([f"no route-map {name}"])
        self.save_config()

    def create_or_update_prefix_list(self, name: str, definition: PrefixListDefinition):
        """
        Completely replaces the given prefix-list with the specified prefixes.
        Assigns new seq numbers starting at 5 and incrementing by 5.
        """
        # Clear existing
        self._configure([f"no ip prefix-list {name}"])

        # Recreate
        cfg = []
        for idx, prefix in enumerate(definition.prefixes, start=1):
            seq = idx * 5
            cfg.append(f"ip prefix-list {name} seq {seq} permit {prefix}")

        self._configure(cfg)
        self.save_config()

    def delete_prefix_list(self, name: str):
        self._configure([f"no ip prefix-list {name}"])
        self.save_config()

    def list_prefix_lists(self) -> List[dict]:
        """
        Parse flat-style FRR prefix-list definitions from running-config.

        Returns:
            List[dict]: Each entry is {
                name: str,
                entries: List[{
                    seq: int,
                    action: str,
                    prefix: str
                }]
            }
        """
        cfg = self._get_running_config()
        prefix_map: dict[str, List[dict]] = {}

        for line in cfg.splitlines():
            line = line.strip()
            if line.startswith("ip prefix-list "):
                m = re.match(r"ip prefix-list (\S+) seq (\d+) (\w+)\s+(.+)", line)
                if m:
                    name, seq, action, prefix = m.groups()
                    prefix_map.setdefault(name, []).append({
                        "seq": int(seq),
                        "action": action,
                        "prefix": prefix
                    })

        return [{"name": name, "entries": entries} for name, entries in prefix_map.items()]

    def list_route_maps(self) -> List[dict]:
        """
        Return all route-map policies from the running config as:
        [{"name": "MAP_NAME", "terms": [{"seq": 10, ...}, ...]}, ...]
        """
        cfg = self._get_running_config()
        route_maps = {}
        current_name = None
        current_seq = None
        term = {}

        for line in cfg.splitlines():
            line = line.strip()

            m = re.match(r"^route-map (\S+) permit (\d+)", line)
            if m:
                # Save previous term
                if current_name and term:
                    route_maps.setdefault(current_name, []).append(term)
                current_name, current_seq = m.group(1), int(m.group(2))
                term = {"seq": current_seq}
                continue

            if "match as-path" in line:
                term["match_as_path"] = line.split()[-1]
            elif "match ip address prefix-list" in line:
                term["match_prefix_list"] = line.split()[-1]
            elif "set community" in line:
                term["set_community"] = " ".join(line.split()[2:]).replace(" additive", "")
            elif "set extcommunity" in line:
                term["set_ext_community"] = " ".join(line.split()[2:]).replace(" additive", "")
            elif "on-match next" in line:
                term["on_match_next"] = True

        # Final flush
        if current_name and term:
            route_maps.setdefault(current_name, []).append(term)

        return [{"name": k, "terms": v} for k, v in route_maps.items()]


    @lru_cache(maxsize=64)
    def _get_prefix_list_entries(self, pl_name: str) -> list[str]:
        """
        Return the individual `seq` lines for *pl_name*.

        Result is cached so multiple neighbours using the same list don't trigger
        multiple vtysh calls.
        """
        if not pl_name:
            return []

        try:
            raw = self._run(f"show ip prefix-list {pl_name}")
        except subprocess.CalledProcessError as err:
            logger.warning("[FRR] could not fetch prefix-list %s: %s", pl_name, err.output)
            return []

        # keep only “seq …” lines, dedupe ZEBRA/BGP copies
        seq_re = re.compile(r"^\s*seq\s+\d+\s+.+", re.I)
        seen = set()
        entries = []
        for line in raw.splitlines():
            if seq_re.match(line) and line not in seen:
                entries.append(line.strip())
                seen.add(line)
        return entries

    def _route_details(self, prefix: str) -> tuple[list[str], list[str], list[str]]:
        """
        Call ``show ip bgp ipv4 unicast <prefix> json`` and return

            (as_path, communities, ext_communities)
        """
        try:
            data = self._run(f"show bgp ipv4 unicast {prefix} json")
            path  = (data.get("paths") or [{}])[0]        # first path only
            aspath = _to_list(path.get("aspath", {}).get("string", path.get("aspath")))
            comms  = _to_list(path.get("community", {}).get("list",[]))
            xcomm  = _to_list(path.get("extCommunity") or path.get("extendedCommunities"))
            return aspath, comms, xcomm
        except Exception as err:                          # pragma: no cover
            logger.debug("No extra route info for %s - %s", prefix, err)
            return [], [], []

    def _get_running_config(self):
        try:
            cfg = self._run("show running-config")
            return cfg
        except Exception:                                   # pragma: no cover
            logger.exception("Could not read running-config, default seq=5")


    def _next_seq(self, section_regex: str) -> int:
        """
        Scan the running-config for *section_regex* and return “highest + 5”.

        Parameters
        ----------
        section_regex
            A compiled regular expression whose first capture-group MUST be the
            sequence number, e.g.::

                r"^ip prefix-list FOO +seq +(\\d+) "

            r"^route-map BAR permit +(\\d+)"

        Returns
        -------
        int
            Next free sequence number (≥ 5, rounded to next multiple of 5).
        """
        cfg = self._get_running_config()

        pat = re.compile(section_regex)
        seqs = [
            int(m.group(1))
            for line in cfg
            if (m := pat.match(line.lstrip())) is not None
        ]
        nxt = (max(seqs) + 5) if seqs else 5
        # keep everything in multiples of 5 (nice & tidy)
        return (nxt + 4) // 5 * 5

    def parse_neighbor_routes(self, parsed: dict) -> list[dict]:
        """
        Flatten the neighbour *advertised*/*received* routes and enrich every entry
        with **as_path**, **communities**, **ext_comms** by querying the global RIB
        when needed.
        """

        routes: list[dict] = []

        for key in ("advertisedRoutes", "receivedRoutes"):
            for pfx, r in parsed.get(key, {}).items():
                applied = r.get("appliedStatusSymbols", {})

                # ── try to grab from neighbour JSON first ──────────────────────
                as_path = _to_list(r.get("path") or r.get("aspath"))
                comms   = _to_list(r.get("community") or r.get("communities"))
                xcomms  = _to_list(
                    r.get("extCommunity") or r.get("extendedCommunities")
                )
                # ── if anything missing → query the global RIB for the prefix ──
                # if not (as_path and comms and xcomms):
                a2, c2, x2 = self._route_details(pfx.replace("\\/", "/"))
                as_path = as_path or a2
                comms   = comms   or c2
                xcomms  = xcomms  or x2

                new_route =   {
                        "prefix":       pfx.replace("\\/", "/"),
                        "next_hop":     r.get("nextHop", ""),
                        "origin":       r.get("bgpOriginCode", ""),
                        "as_path":      as_path,
                        "communities":  comms,
                        "ext_comms":    xcomms,
                        "weight":       r.get("weight", 0),
                        "metric":       r.get("metric", 0),
                        "best":         applied.get(">", False),
                        "valid":        applied.get("*", False),
                    }
                routes.append(new_route)

        return routes

    def create_or_update_prefix_list(self, name: str, definition: PrefixListDefinition):
        """
        Completely replaces the given prefix-list with the specified prefixes.
        Assigns new seq numbers starting at 5 and incrementing by 5.
        """
        # Clear existing
        self._configure([f"no ip prefix-list {name}"])

        # Recreate
        cfg = []
        for idx, prefix in enumerate(definition.prefixes, start=1):
            seq = idx * 5
            cfg.append(f"ip prefix-list {name} seq {seq} permit {prefix}")

        self._configure(cfg)
        self.save_config()

    @lru_cache(maxsize=256)
    def _detect_iface(self, network: str) -> str:
        """
        Search *running-config* for a matching static-route line and return the
        interface name.  Falls back to **Null0**.

            ip route 198.19.52.0/23 <iface>

        Parameters
        ----------
        frr_run_cfg : str
            Complete text of “show running-config”.
        network : str
            The exact “<prefix>/<mask>” string we're about to install.

        Returns
        -------
        str  - interface (e.g. ``eth0``, ``vxlan100`` …) or ``Null0``.
        """
        run_config = self._get_running_config()
        patt = re.compile(rf"^ip route {re.escape(network)} (\S+)", re.M)
        logger.info(patt.search(run_config))
        if m := patt.search(run_config):
            logger.info(m)
            return m.group(1)
        try:
            net_obj = ipaddress.ip_network(network, strict=False)
        except ValueError:
            return "Null0"

        candidates: dict[int, str] = {}      # prefixlen  ➜  iface
        for line in run_config.splitlines():
            if not line.startswith("ip route"):
                continue
            try:
                _, _, pfx, iface = line.split(maxsplit=3)
                pnet = ipaddress.ip_network(pfx, strict=False)
                if pnet.supernet_of(net_obj):
                    candidates[pnet.prefixlen] = iface.split()[0]
            except Exception:
                continue

        if candidates:
            # pick the *longest* prefix match (closest super-net)
            best = max(candidates)
            return candidates[best]

        return "Null0"

    def clear_bgp_soft(self):
        self._run("clear ip bgp * soft")

    def add_bmp_server(
        self,
        address: str,
        port: int = 11019,
        route_monitoring_policy: str = "post-policy",
        statistics_timeout: int = 0,
        route_mirroring_enabled: bool = False
    ):
        """
        Add a BMP (BGP Monitoring Protocol) server to FRR.

        Args:
            address: BMP collector IP address
            port: BMP collector port (default: 11019)
            route_monitoring_policy: Monitoring policy - 'pre-policy', 'post-policy', 'both', 'all' (default: post-policy)
            statistics_timeout: Statistics interval in seconds (default: 0 = disabled)
            route_mirroring_enabled: Enable route mirroring (default: False)

        Note:
            FRR only supports 'pre-policy' and 'post-policy'. If 'both' or 'all' is specified,
            both pre-policy and post-policy will be configured.
        """
        try:
            # Map policy names - FRR doesn't support 'all' or 'both', but we can configure both policies
            if route_monitoring_policy in ["both", "all"]:
                policies = ["pre-policy", "post-policy"]
            else:
                # Default to post-policy if invalid
                policies = [route_monitoring_policy if route_monitoring_policy in ["pre-policy", "post-policy"] else "post-policy"]

            config_lines = [
                f"router bgp {self.asn}",
                f" bmp targets {address}",
                f"  bmp connect {address} port {port} min-retry 1000 max-retry 2000",
            ]

            # Add monitoring for each policy
            for policy in policies:
                config_lines.append(f"  bmp monitor ipv4 unicast {policy}")
                config_lines.append(f"  bmp monitor ipv6 unicast {policy}")

            # Note: FRR does not support 'bmp stats interval' command
            # Statistics are automatically sent based on BMP protocol
            # The statistics_timeout parameter is ignored for FRR

            # Add route mirroring if enabled
            if route_mirroring_enabled:
                config_lines.append(f"  bmp mirror")

            config_lines.extend([
                " exit",
                "exit"
            ])

            self._configure(config_lines)
            self.save_config()
            logger.info(f"[BMP] Added BMP server {address}:{port} with policy '{route_monitoring_policy}'")
        except HTTPException as e:
            # Check if already configured
            if "already" in str(e.detail).lower():
                logger.info(f"[BMP] BMP server {address}:{port} already configured")
                raise HTTPException(status_code=409, detail="BMP server already configured")
            logger.exception(f"Failed to add BMP server")
            raise
        except Exception as e:
            logger.exception(f"Failed to add BMP server")
            raise HTTPException(status_code=500, detail=f"Failed to add BMP server: {str(e)}")

    def delete_bmp_server(self, address: str, port: int = 11019):
        """Delete a BMP server from FRR"""
        try:
            config_lines = [
                f"router bgp {self.asn}",
                f" no bmp targets {address}",
                "exit"
            ]

            self._configure(config_lines)
            self.save_config()
            logger.info(f"[BMP] Deleted BMP server {address}:{port}")
        except Exception as e:
            logger.exception(f"Failed to delete BMP server")
            raise HTTPException(status_code=500, detail=f"Failed to delete BMP server: {str(e)}")

    def list_bmp_servers(self) -> List[dict]:
        """List all BMP servers configured in FRR"""
        try:
            # Get running config and parse BMP section
            config = self._get_running_config()
            bmp_servers = []

            # Parse BMP targets from config
            in_bmp_section = False
            current_target = None

            for line in config.split('\n'):
                line = line.strip()

                # Start of BMP targets section
                if line.startswith('bmp targets '):
                    target_addr = line.replace('bmp targets ', '').strip()
                    current_target = {
                        "address": target_addr,
                        "port": 11019,  # default
                        "monitoring_policies": []
                    }
                    in_bmp_section = True

                # End of BMP targets section
                elif line == 'exit' and in_bmp_section:
                    if current_target:
                        bmp_servers.append(current_target)
                        current_target = None
                    in_bmp_section = False

                # Parse BMP configuration within section
                elif in_bmp_section and current_target:
                    if 'bmp connect' in line and 'port' in line:
                        # Extract port number
                        parts = line.split()
                        if 'port' in parts:
                            port_idx = parts.index('port') + 1
                            if port_idx < len(parts):
                                try:
                                    current_target["port"] = int(parts[port_idx])
                                except ValueError:
                                    pass

                    elif 'bmp monitor' in line:
                        # Extract monitoring policy
                        parts = line.split()
                        if len(parts) >= 4:
                            afi = parts[2]  # ipv4/ipv6
                            safi = parts[3] if len(parts) > 3 else ""  # unicast
                            policy = parts[4] if len(parts) > 4 else "post-policy"
                            current_target["monitoring_policies"].append(f"{afi} {safi} {policy}")

            return bmp_servers
        except Exception as e:
            logger.exception(f"Failed to list BMP servers")
            # Return empty list instead of raising error
            return []

def _to_list(raw) -> list[str]:
    """Normalise FRR community / ext-community blobs into a list[str]."""
    if not raw:
        return []
    if isinstance(raw, list):
        return [str(x) for x in raw]
    if isinstance(raw, dict):
        return [str(x) for x in raw.get("list", [])] or str(raw.get("string", "")).split()
    return [tok for tok in str(raw).split() if tok]

def _split_list(val: Optional[str]) -> List[str]:
    """
    Turn *None*  → []
         "65000:1 65000:2" → ["65000:1", "65000:2"]
    """
    if not val:
        return []
    return [p for p in val.split() if p]

