#!/usr/bin/env python3
"""
FlowSpec to iptables Enforcer

This script monitors BGP FlowSpec routes received by FRR and converts them
to iptables rules for actual traffic enforcement.

FRR can receive FlowSpec routes but cannot install them in the kernel.
This script bridges that gap by:
1. Periodically parsing FlowSpec routes from vtysh
2. Converting them to iptables rules
3. Managing the lifecycle of rules (add/remove)

Supported FlowSpec actions:
- rate=0 -> DROP (iptables -j DROP)
- rate>0 -> POLICE (tc + iptables marking)
- redirect -> MARK for policy routing
"""

import subprocess
import re
import time
import logging
import argparse
import signal
import sys
from dataclasses import dataclass
from typing import List, Dict, Optional, Set

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger('flowspec-enforcer')

# iptables chain name for FlowSpec rules
FLOWSPEC_CHAIN = "FLOWSPEC"


@dataclass
class FlowSpecRule:
    """Represents a parsed FlowSpec rule"""
    dest_addr: Optional[str] = None
    src_addr: Optional[str] = None
    protocol: Optional[int] = None
    dest_port: Optional[int] = None
    src_port: Optional[int] = None
    rate: Optional[float] = None

    def __hash__(self):
        return hash((self.dest_addr, self.src_addr, self.protocol,
                     self.dest_port, self.src_port))

    def __eq__(self, other):
        if not isinstance(other, FlowSpecRule):
            return False
        return (self.dest_addr == other.dest_addr and
                self.src_addr == other.src_addr and
                self.protocol == other.protocol and
                self.dest_port == other.dest_port and
                self.src_port == other.src_port)

    def to_iptables_match(self) -> str:
        """Convert to iptables match string"""
        parts = []

        if self.src_addr:
            parts.append(f"-s {self.src_addr}")
        if self.dest_addr:
            parts.append(f"-d {self.dest_addr}")
        if self.protocol:
            proto_map = {6: 'tcp', 17: 'udp', 1: 'icmp'}
            proto = proto_map.get(self.protocol, str(self.protocol))
            parts.append(f"-p {proto}")

            # Port matches only for TCP/UDP
            if self.protocol in (6, 17):
                if self.dest_port:
                    parts.append(f"--dport {self.dest_port}")
                if self.src_port:
                    parts.append(f"--sport {self.src_port}")

        return " ".join(parts)

    def get_tc_filter_id(self) -> int:
        """Get a unique filter ID for this rule (1-65535)"""
        return (hash(self) & 0xFFFF) or 1  # Ensure non-zero

    def to_iptables_action(self) -> str:
        """Convert rate to iptables action"""
        # For rate=0, drop the traffic
        # For rate>0, we use tc for policing, so just ACCEPT here (tc handles the drop)
        if self.rate is None or self.rate == 0:
            return "-j DROP"
        else:
            # Let the packet through - tc will police it
            return "-j ACCEPT"

    def get_rate_kbit(self) -> int:
        """Get rate in kbit/s for tc"""
        if self.rate is None:
            return 0
        return int(self.rate * 1000)  # Mbps to kbit/s

    def to_tc_u32_match(self) -> str:
        """Build tc u32 match string for this rule.

        Note: We only match on IP addresses and protocol here, NOT ports.
        The tc u32 port matching (match tcp/udp dst/src) is unreliable in
        many Linux kernel/tc versions. Port filtering is handled by iptables
        which is applied before tc sees the packet.
        """
        matches = []

        # Match source IP (at offset 12 in IP header)
        if self.src_addr:
            matches.append(f"match ip src {self.src_addr}")

        # Match destination IP (at offset 16 in IP header)
        if self.dest_addr:
            matches.append(f"match ip dst {self.dest_addr}")

        # Match protocol (at offset 9 in IP header, use "ip protocol" keyword)
        if self.protocol:
            matches.append(f"match ip protocol {self.protocol} 0xff")

        # Note: Port matching is intentionally NOT included here.
        # The tc u32 "match tcp dst" / "match udp dst" syntax doesn't work
        # reliably across kernel versions. Instead, iptables handles the
        # port filtering, and tc only does rate limiting on IP+protocol.

        return " ".join(matches)

    def description(self) -> str:
        """Human readable description"""
        parts = []
        if self.src_addr:
            parts.append(f"src={self.src_addr}")
        if self.dest_addr:
            parts.append(f"dst={self.dest_addr}")
        if self.protocol:
            parts.append(f"proto={self.protocol}")
        if self.dest_port:
            parts.append(f"dport={self.dest_port}")
        if self.src_port:
            parts.append(f"sport={self.src_port}")
        if self.rate is not None:
            parts.append(f"rate={self.rate}Mbps")
        return " ".join(parts)


def run_cmd(cmd: str, check: bool = True) -> subprocess.CompletedProcess:
    """Run a shell command"""
    logger.debug(f"Running: {cmd}")
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, check=check)


def get_flowspec_routes() -> List[FlowSpecRule]:
    """Parse FlowSpec routes from FRR vtysh"""
    rules = []

    try:
        result = run_cmd('vtysh -c "show bgp ipv4 flowspec detail" 2>/dev/null', check=False)
        if result.returncode != 0:
            logger.warning("Failed to get FlowSpec routes from vtysh")
            return rules

        output = result.stdout
        current_rule = None

        for line in output.split('\n'):
            line = line.strip()

            # New entry starts with "BGP flowspec entry"
            if line.startswith('BGP flowspec entry'):
                if current_rule:
                    rules.append(current_rule)
                current_rule = FlowSpecRule()
                continue

            if not current_rule:
                continue

            # Parse destination address
            if line.startswith('Destination Address'):
                match = re.search(r'(\d+\.\d+\.\d+\.\d+/\d+)', line)
                if match:
                    current_rule.dest_addr = match.group(1)

            # Parse source address
            elif line.startswith('Source Address'):
                match = re.search(r'(\d+\.\d+\.\d+\.\d+/\d+)', line)
                if match:
                    current_rule.src_addr = match.group(1)

            # Parse protocol
            elif line.startswith('IP Protocol'):
                match = re.search(r'=\s*(\d+)', line)
                if match:
                    current_rule.protocol = int(match.group(1))

            # Parse destination port
            elif line.startswith('Destination Port'):
                match = re.search(r'=\s*(\d+)', line)
                if match:
                    current_rule.dest_port = int(match.group(1))

            # Parse source port
            elif line.startswith('Source Port'):
                match = re.search(r'=\s*(\d+)', line)
                if match:
                    current_rule.src_port = int(match.group(1))

            # Parse rate
            elif line.startswith('FS:rate'):
                match = re.search(r'FS:rate\s+([\d.]+)', line)
                if match:
                    current_rule.rate = float(match.group(1))

        # Don't forget the last rule
        if current_rule:
            rules.append(current_rule)

    except Exception as e:
        logger.error(f"Error parsing FlowSpec routes: {e}")

    return rules


def setup_iptables_chain():
    """Setup the FLOWSPEC iptables chain"""
    # Check if chain exists
    result = run_cmd(f"iptables -L {FLOWSPEC_CHAIN} -n 2>/dev/null", check=False)

    if result.returncode != 0:
        # Create chain
        logger.info(f"Creating iptables chain {FLOWSPEC_CHAIN}")
        run_cmd(f"iptables -N {FLOWSPEC_CHAIN}")

    # Ensure chain is referenced from FORWARD (for routed traffic)
    result = run_cmd(f"iptables -C FORWARD -j {FLOWSPEC_CHAIN} 2>/dev/null", check=False)
    if result.returncode != 0:
        logger.info(f"Adding jump to {FLOWSPEC_CHAIN} from FORWARD chain")
        run_cmd(f"iptables -I FORWARD -j {FLOWSPEC_CHAIN}")

    # Also add to INPUT for local traffic
    result = run_cmd(f"iptables -C INPUT -j {FLOWSPEC_CHAIN} 2>/dev/null", check=False)
    if result.returncode != 0:
        logger.info(f"Adding jump to {FLOWSPEC_CHAIN} from INPUT chain")
        run_cmd(f"iptables -I INPUT -j {FLOWSPEC_CHAIN}")


def get_existing_rules() -> Set[str]:
    """Get existing rules in the FLOWSPEC chain"""
    rules = set()
    result = run_cmd(f"iptables -L {FLOWSPEC_CHAIN} -n --line-numbers 2>/dev/null", check=False)

    if result.returncode == 0:
        for line in result.stdout.split('\n'):
            # Skip header lines
            if line.startswith('Chain') or line.startswith('num') or not line.strip():
                continue
            # Extract rule (everything after the line number)
            parts = line.split(None, 1)
            if len(parts) > 1:
                rules.add(parts[1].strip())

    return rules


def setup_tc_policing(interface: str = "eth0"):
    """Setup tc qdisc for policing traffic with u32 classifiers"""
    # Check if ingress qdisc already exists
    result = run_cmd(f"tc qdisc show dev {interface}", check=False)
    if "ingress" not in result.stdout:
        # Add ingress qdisc for incoming traffic policing
        run_cmd(f"tc qdisc add dev {interface} handle ffff: ingress", check=False)
        logger.info(f"Added ingress qdisc to {interface}")


def add_tc_filter(rule: FlowSpecRule, interface: str = "eth0") -> bool:
    """Add tc filter with u32 classifier to police traffic"""
    if rule.rate is None or rule.rate == 0:
        return True  # No tc needed for DROP rules (iptables handles it)

    filter_id = rule.get_tc_filter_id()
    rate_kbit = rule.get_rate_kbit()
    burst = max(32000, rate_kbit * 125)  # burst in bytes, ~1 second worth, min 32KB
    u32_match = rule.to_tc_u32_match()

    if not u32_match:
        logger.warning(f"No u32 match conditions for rule: {rule}")
        return False

    # Delete existing filter with this prio first (to avoid duplicates)
    run_cmd(f"tc filter del dev {interface} parent ffff: prio {filter_id & 0xFF} 2>/dev/null", check=False)

    # Add u32 filter with police action
    # Use u32 to match on IP addresses/ports directly at ingress
    cmd = (f"tc filter add dev {interface} parent ffff: protocol ip prio {filter_id & 0xFF} "
           f"u32 {u32_match} "
           f"police rate {rate_kbit}kbit burst {burst} drop flowid :1")

    try:
        run_cmd(cmd)
        logger.info(f"Added tc u32 police on {interface}: {u32_match} -> {rate_kbit}kbit/s")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to add tc filter: {e.stderr}")
        return False


def remove_tc_filter(rule: FlowSpecRule, interface: str = "eth0") -> bool:
    """Remove tc filter for a rule"""
    if rule.rate is None or rule.rate == 0:
        return True  # No tc for DROP rules

    filter_id = rule.get_tc_filter_id()
    cmd = f"tc filter del dev {interface} parent ffff: prio {filter_id & 0xFF}"

    try:
        run_cmd(cmd, check=False)
        logger.info(f"Removed tc filter prio {filter_id & 0xFF} on {interface}")
        return True
    except Exception as e:
        logger.warning(f"Failed to remove tc filter: {e}")
        return False


def add_iptables_rule(rule: FlowSpecRule) -> bool:
    """Add an iptables rule for a FlowSpec entry"""
    match = rule.to_iptables_match()
    action = rule.to_iptables_action()

    if not match:
        logger.warning(f"Empty match for rule: {rule}")
        return False

    cmd = f"iptables -A {FLOWSPEC_CHAIN} {match} {action}"

    try:
        run_cmd(cmd)
        # If this is a rate-limit rule (not DROP), also add tc filter
        if rule.rate and rule.rate > 0:
            # Setup tc on all interfaces
            for iface in get_network_interfaces():
                setup_tc_policing(iface)
                add_tc_filter(rule, iface)
        logger.info(f"Added iptables rule: {rule.description()}")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to add rule: {e.stderr}")
        return False


def remove_iptables_rule(rule: FlowSpecRule) -> bool:
    """Remove an iptables rule"""
    match = rule.to_iptables_match()
    action = rule.to_iptables_action()

    cmd = f"iptables -D {FLOWSPEC_CHAIN} {match} {action}"

    try:
        run_cmd(cmd, check=False)
        # Also remove tc filter if it was a rate-limit rule
        if rule.rate and rule.rate > 0:
            for iface in get_network_interfaces():
                remove_tc_filter(rule, iface)
        logger.info(f"Removed iptables rule: {rule.description()}")
        return True
    except Exception as e:
        logger.warning(f"Failed to remove rule: {e}")
        return False


def get_network_interfaces() -> List[str]:
    """Get list of network interfaces (excluding lo)"""
    result = run_cmd("ip -o link show | awk -F': ' '{print $2}' | grep -v lo", check=False)
    interfaces = [iface.strip().split('@')[0] for iface in result.stdout.strip().split('\n') if iface.strip()]
    return interfaces if interfaces else ["eth0"]


def flush_flowspec_chain():
    """Flush all rules from the FLOWSPEC chain"""
    logger.info(f"Flushing {FLOWSPEC_CHAIN} chain")
    run_cmd(f"iptables -F {FLOWSPEC_CHAIN}", check=False)


def sync_rules(current_rules: Dict[int, FlowSpecRule], new_rules: List[FlowSpecRule]) -> Dict[int, FlowSpecRule]:
    """Synchronize iptables rules with FlowSpec routes"""
    new_rule_set = {hash(r): r for r in new_rules}

    # Find rules to remove (in current but not in new)
    for rule_hash, rule in list(current_rules.items()):
        if rule_hash not in new_rule_set:
            remove_iptables_rule(rule)
            del current_rules[rule_hash]

    # Find rules to add (in new but not in current)
    for rule_hash, rule in new_rule_set.items():
        if rule_hash not in current_rules:
            if add_iptables_rule(rule):
                current_rules[rule_hash] = rule

    return current_rules


def cleanup(signum=None, frame=None):
    """Cleanup on exit"""
    logger.info("Cleaning up FlowSpec iptables rules...")
    flush_flowspec_chain()

    # Remove chain references
    run_cmd(f"iptables -D FORWARD -j {FLOWSPEC_CHAIN}", check=False)
    run_cmd(f"iptables -D INPUT -j {FLOWSPEC_CHAIN}", check=False)

    # Delete chain
    run_cmd(f"iptables -X {FLOWSPEC_CHAIN}", check=False)

    logger.info("Cleanup complete")
    sys.exit(0)


def main():
    parser = argparse.ArgumentParser(description='FlowSpec to iptables enforcer')
    parser.add_argument('--interval', type=int, default=5,
                        help='Polling interval in seconds (default: 5)')
    parser.add_argument('--debug', action='store_true',
                        help='Enable debug logging')
    parser.add_argument('--once', action='store_true',
                        help='Run once and exit (for testing)')
    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    # Setup signal handlers for cleanup
    signal.signal(signal.SIGTERM, cleanup)
    signal.signal(signal.SIGINT, cleanup)

    logger.info("Starting FlowSpec to iptables enforcer")
    logger.info(f"Polling interval: {args.interval}s")

    # Setup iptables chain
    setup_iptables_chain()

    # Flush existing rules to start fresh (avoids duplicates from restarts)
    flush_flowspec_chain()

    # Track current rules
    current_rules: Dict[int, FlowSpecRule] = {}

    try:
        while True:
            # Get current FlowSpec routes
            flowspec_rules = get_flowspec_routes()

            if flowspec_rules:
                logger.debug(f"Found {len(flowspec_rules)} FlowSpec rules")

            # Sync with iptables
            current_rules = sync_rules(current_rules, flowspec_rules)

            if args.once:
                logger.info(f"One-shot mode: processed {len(current_rules)} rules")
                break

            time.sleep(args.interval)

    except KeyboardInterrupt:
        pass
    finally:
        if not args.once:
            cleanup()


if __name__ == '__main__':
    main()
