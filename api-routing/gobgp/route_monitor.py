"""
Route Monitor for GoBGP - Monitors routes and takes actions based on criteria

This module provides automated route monitoring and action-taking capabilities:
1. Monitor routes matching specific criteria (prefix, AS-path, community)
2. Take actions when routes are learned/withdrawn (filter, modify, forward to webhook)
3. Maintain route state and trigger callbacks on changes
"""

import asyncio
import logging
from typing import List, Dict, Callable, Optional, Any
from dataclasses import dataclass
from enum import Enum
import re
import ipaddress
import os
import sys

# Fix PyGoBGP import path issue
pygobgp_api_path = '/usr/local/lib/python3.13/site-packages/pygobgp/api'
if os.path.exists(pygobgp_api_path) and pygobgp_api_path not in sys.path:
    sys.path.insert(0, pygobgp_api_path)

import httpx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("route-monitor")


class MatchType(Enum):
    PREFIX = "prefix"
    AS_PATH = "as_path"
    COMMUNITY = "community"
    NEXT_HOP = "next_hop"


class ActionType(Enum):
    ACCEPT = "accept"
    REJECT = "reject"
    SET_COMMUNITY = "set_community"
    ADD_COMMUNITY = "add_community"  # Append community instead of replacing
    PREPEND_AS = "prepend_as"
    SET_MED = "set_med"
    SET_LOCAL_PREF = "set_local_pref"
    GENERATE_SUMMARY = "generate_summary"  # Create aggregate route
    WEBHOOK = "webhook"
    LOG = "log"


@dataclass
class RouteCriteria:
    """Criteria for matching routes"""
    name: str
    match_type: MatchType
    pattern: str  # regex or prefix pattern
    description: str = ""

    def matches(self, route: Dict[str, Any]) -> bool:
        """Check if a route matches this criteria"""
        try:
            # Extract attributes (handle both nested and flat structures)
            attrs = route.get("attributes", {})

            if self.match_type == MatchType.PREFIX:
                return self._match_prefix(route.get("prefix", ""))
            elif self.match_type == MatchType.AS_PATH:
                as_path = attrs.get("as_path") or route.get("as_path", [])
                return self._match_as_path(as_path)
            elif self.match_type == MatchType.COMMUNITY:
                communities = attrs.get("communities") or route.get("community", [])
                return self._match_community(communities)
            elif self.match_type == MatchType.NEXT_HOP:
                next_hop = attrs.get("next_hop") or route.get("next_hop", "")
                return self._match_next_hop(next_hop)
        except Exception as e:
            logger.error(f"Error matching route against criteria {self.name}: {e}")
        return False

    def _match_prefix(self, prefix: str) -> bool:
        """Match prefix using CIDR notation or regex"""
        try:
            # Try exact match first
            if self.pattern == prefix:
                return True

            # Try subnet match
            if "/" in self.pattern and "/" in prefix:
                pattern_net = ipaddress.ip_network(self.pattern, strict=False)
                prefix_net = ipaddress.ip_network(prefix, strict=False)
                return prefix_net.subnet_of(pattern_net) or prefix_net == pattern_net

            # Try regex match
            return bool(re.match(self.pattern, prefix))
        except Exception:
            return False

    def _match_as_path(self, as_path: List) -> bool:
        """Match AS path using regex"""
        as_path_str = " ".join(str(asn) for asn in as_path)
        return bool(re.search(self.pattern, as_path_str))

    def _match_community(self, communities: List) -> bool:
        """Match community string"""
        for comm in communities:
            if re.search(self.pattern, str(comm)):
                return True
        return False

    def _match_next_hop(self, next_hop: str) -> bool:
        """Match next-hop IP"""
        return bool(re.match(self.pattern, next_hop))


@dataclass
class RouteAction:
    """Action to take on matching routes"""
    action_type: ActionType
    parameters: Dict[str, Any]

    async def execute(self, route: Dict[str, Any], gobgp_manager) -> Dict[str, Any]:
        """Execute the action on a route"""
        result = {"action": self.action_type.value, "route": route["prefix"], "success": False}

        try:
            # Extract attributes (handle both nested and flat structures)
            attrs = route.get("attributes", {})
            next_hop = attrs.get("next_hop") or route.get("next_hop")
            as_path = attrs.get("as_path") or route.get("as_path", [])
            communities = attrs.get("communities") or route.get("community", [])
            med = attrs.get("med") or route.get("med")
            local_pref = attrs.get("local_pref") or route.get("local_pref")

            if self.action_type == ActionType.ACCEPT:
                result["success"] = True
                result["message"] = "Route accepted"

            elif self.action_type == ActionType.REJECT:
                # Withdraw the route
                prefix, cidr = route["prefix"].split("/")
                gobgp_manager.withdraw_route(prefix, cidr)
                result["success"] = True
                result["message"] = "Route rejected and withdrawn"

            elif self.action_type == ActionType.SET_COMMUNITY:
                # Re-advertise with new community (replace)
                prefix, cidr = route["prefix"].split("/")
                community = self.parameters.get("community", "")
                gobgp_manager.advertise_route(
                    prefix, cidr,
                    next_hop=next_hop,
                    community=community,
                    as_path=" ".join(str(a) for a in as_path) if as_path else None,
                    med=med
                )
                result["success"] = True
                result["message"] = f"Community set to {community}"

            elif self.action_type == ActionType.ADD_COMMUNITY:
                # Re-advertise with appended community
                prefix, cidr = route["prefix"].split("/")
                new_community = self.parameters.get("community", "")

                # Append to existing communities
                all_communities = list(communities) if communities else []
                if new_community:
                    all_communities.append(new_community)

                gobgp_manager.advertise_route(
                    prefix, cidr,
                    next_hop=next_hop,
                    community=" ".join(all_communities),
                    as_path=" ".join(str(a) for a in as_path) if as_path else None,
                    med=med
                )
                result["success"] = True
                result["message"] = f"Added community {new_community} (total: {len(all_communities)})"

            elif self.action_type == ActionType.PREPEND_AS:
                # Prepend AS to path and re-advertise
                prefix, cidr = route["prefix"].split("/")
                prepend_asn = self.parameters.get("asn", gobgp_manager.asn)
                count = self.parameters.get("count", 1)

                new_path = [prepend_asn] * count + list(as_path)

                gobgp_manager.advertise_route(
                    prefix, cidr,
                    next_hop=next_hop,
                    as_path=" ".join(str(a) for a in new_path),
                    community=" ".join(communities) if communities else None,
                    med=med
                )
                result["success"] = True
                result["message"] = f"Prepended AS {prepend_asn} x{count}"

            elif self.action_type == ActionType.SET_MED:
                # Set MED value and re-advertise
                prefix, cidr = route["prefix"].split("/")
                new_med = self.parameters.get("med", 0)

                gobgp_manager.advertise_route(
                    prefix, cidr,
                    next_hop=next_hop,
                    med=new_med,
                    as_path=" ".join(str(a) for a in as_path) if as_path else None,
                    community=" ".join(communities) if communities else None
                )
                result["success"] = True
                result["message"] = f"MED set to {new_med}"

            elif self.action_type == ActionType.SET_LOCAL_PREF:
                # Set local preference and re-advertise
                prefix, cidr = route["prefix"].split("/")
                new_local_pref = self.parameters.get("local_pref", 100)

                # Note: PyGoBGP v3 needs to support local_pref in advertise_route
                gobgp_manager.advertise_route(
                    prefix, cidr,
                    next_hop=next_hop,
                    as_path=" ".join(str(a) for a in as_path) if as_path else None,
                    community=" ".join(communities) if communities else None,
                    med=med
                )
                result["success"] = True
                result["message"] = f"Local preference set to {new_local_pref}"
                result["warning"] = "Local preference modification requires PyGoBGP enhancement"

            elif self.action_type == ActionType.GENERATE_SUMMARY:
                # Generate a summary/aggregate route
                summary_prefix = self.parameters.get("summary_prefix")
                if not summary_prefix:
                    raise ValueError("summary_prefix parameter required for GENERATE_SUMMARY")

                prefix, cidr = summary_prefix.split("/")
                summary_community = self.parameters.get("community", "65000:999")
                summary_med = self.parameters.get("med", 50)

                gobgp_manager.advertise_route(
                    prefix, cidr,
                    next_hop=self.parameters.get("next_hop", next_hop),
                    community=summary_community,
                    as_path=str(gobgp_manager.asn),  # Originate locally
                    med=summary_med
                )
                result["success"] = True
                result["message"] = f"Generated summary route {summary_prefix}"

            elif self.action_type == ActionType.WEBHOOK:
                # Send route data to webhook
                url = self.parameters.get("url")
                if url:
                    await self._send_webhook(url, route)
                    result["success"] = True
                    result["message"] = f"Webhook sent to {url}"

            elif self.action_type == ActionType.LOG:
                # Just log the route
                logger.info(f"Route matched: {route}")
                result["success"] = True
                result["message"] = "Route logged"

        except Exception as e:
            logger.exception(f"Failed to execute action {self.action_type}")
            result["error"] = str(e)

        return result

    async def _send_webhook(self, url: str, route: Dict[str, Any]):
        """Send route data to webhook URL"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    url,
                    json={
                        "event": "route_matched",
                        "route": route,
                        "action": self.action_type.value,
                        "parameters": self.parameters
                    },
                    timeout=5.0
                )
                response.raise_for_status()
                logger.info(f"Webhook sent successfully to {url}")
            except Exception as e:
                logger.error(f"Failed to send webhook to {url}: {e}")


@dataclass
class RoutePolicy:
    """Complete policy with criteria and actions"""
    name: str
    criteria: List[RouteCriteria]
    actions: List[RouteAction]
    match_all: bool = True  # True = AND, False = OR
    enabled: bool = True

    def matches(self, route: Dict[str, Any]) -> bool:
        """Check if route matches this policy"""
        if not self.enabled:
            return False

        if not self.criteria:
            return False

        matches = [c.matches(route) for c in self.criteria]

        if self.match_all:
            return all(matches)  # AND
        else:
            return any(matches)  # OR

    async def execute_actions(self, route: Dict[str, Any], gobgp_manager) -> List[Dict]:
        """Execute all actions for this policy"""
        results = []
        for action in self.actions:
            result = await action.execute(route, gobgp_manager)
            results.append(result)
        return results


class RouteMonitor:
    """Monitor routes and execute policies"""

    def __init__(self, gobgp_manager):
        self.gobgp_manager = gobgp_manager
        self.policies: List[RoutePolicy] = []
        self.route_cache: Dict[str, Dict] = {}  # prefix -> route data
        self.running = False

    def add_policy(self, policy: RoutePolicy):
        """Add a route policy"""
        self.policies.append(policy)
        logger.info(f"Added policy: {policy.name}")

    def remove_policy(self, name: str):
        """Remove a policy by name"""
        self.policies = [p for p in self.policies if p.name != name]
        logger.info(f"Removed policy: {name}")

    def get_policies(self) -> List[Dict]:
        """Get all policies as dicts"""
        return [
            {
                "name": p.name,
                "enabled": p.enabled,
                "match_all": p.match_all,
                "criteria_count": len(p.criteria),
                "actions_count": len(p.actions)
            }
            for p in self.policies
        ]

    async def check_route(self, route: Dict[str, Any]) -> List[Dict]:
        """Check a route against all policies and execute matching actions"""
        results = []

        for policy in self.policies:
            if policy.matches(route):
                logger.info(f"Route {route.get('prefix')} matched policy: {policy.name}")
                action_results = await policy.execute_actions(route, self.gobgp_manager)
                results.append({
                    "policy": policy.name,
                    "route": route.get("prefix"),
                    "actions": action_results
                })

        return results

    async def monitor_routes(self, interval: int = 5):
        """Periodically monitor routes and check against policies"""
        self.running = True
        logger.info(f"Starting route monitor (interval={interval}s)")

        while self.running:
            try:
                # Get current routes
                current_routes = self.gobgp_manager.client.get_rib()

                # Track new/changed routes
                current_prefixes = set()

                for route in current_routes:
                    prefix = route.get("prefix")
                    current_prefixes.add(prefix)

                    # Check if this is a new or modified route
                    if prefix not in self.route_cache or self.route_cache[prefix] != route:
                        logger.info(f"New/updated route detected: {prefix}")
                        self.route_cache[prefix] = route

                        # Check against policies
                        await self.check_route(route)

                # Detect withdrawn routes
                withdrawn = set(self.route_cache.keys()) - current_prefixes
                for prefix in withdrawn:
                    logger.info(f"Route withdrawn: {prefix}")
                    del self.route_cache[prefix]

            except Exception as e:
                logger.exception("Error in route monitor loop")

            await asyncio.sleep(interval)

    def stop(self):
        """Stop the route monitor"""
        self.running = False
        logger.info("Route monitor stopped")
