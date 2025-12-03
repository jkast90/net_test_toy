import grpc
import socket
import struct
from pygobgp.api import gobgp_pb2 as gobgp
from pygobgp.api import gobgp_pb2_grpc as gobgp_grpc
from pygobgp.errors import PeerNotFound


class PyGoBGP:
    """GoBGP v3 Python API Wrapper"""

    def __init__(self, address, port=50051):
        """Connect to GoBGP via gRPC"""
        self.gobgp_address = f"{address}:{port}"
        self.channel = grpc.insecure_channel(self.gobgp_address)
        self.stub = gobgp_grpc.GobgpApiStub(self.channel)

    def get_rib(self, family=None):
        """
        Get routes in BGP RIB.

        Args:
            family: Address family (default: IPv4 unicast)

        Returns:
            List of routes with parsed attributes
        """
        if family is None:
            # IPv4 unicast
            family = gobgp.Family(
                afi=gobgp.Family.AFI_IP,
                safi=gobgp.Family.SAFI_UNICAST
            )

        request = gobgp.ListPathRequest(
            table_type=gobgp.GLOBAL,
            family=family
        )

        routes = []
        try:
            for response in self.stub.ListPath(request):
                route = self._parse_path(response)
                if route:
                    routes.append(route)
        except grpc.RpcError as e:
            print(f"gRPC error getting RIB: {e}")

        return routes

    def _parse_path(self, path_response):
        """Parse a path response into a friendly dict"""
        if not path_response or not path_response.destination:
            return None

        dest = path_response.destination

        # Parse prefix
        prefix = dest.prefix

        # Parse path attributes
        attrs = {}
        if dest.paths:
            path = dest.paths[0]

            # In v3, attributes are in google.protobuf.Any format
            # We need to unpack them to get the actual attribute types
            from google.protobuf import any_pb2
            from pygobgp.api import attribute_pb2

            if path.pattrs:
                for pattr_any in path.pattrs:
                    # Check the type URL to determine which attribute this is
                    type_url = pattr_any.type_url

                    # Next hop
                    if 'NextHopAttribute' in type_url:
                        nh_attr = attribute_pb2.NextHopAttribute()
                        pattr_any.Unpack(nh_attr)
                        attrs['next_hop'] = nh_attr.next_hop
                    # AS path
                    elif 'AsPathAttribute' in type_url:
                        as_attr = attribute_pb2.AsPathAttribute()
                        pattr_any.Unpack(as_attr)
                        as_segments = []
                        for segment in as_attr.segments:
                            as_segments.extend(segment.numbers)
                        attrs['as_path'] = as_segments
                    # Communities
                    elif 'CommunitiesAttribute' in type_url:
                        comm_attr = attribute_pb2.CommunitiesAttribute()
                        pattr_any.Unpack(comm_attr)
                        attrs['communities'] = [f"{c >> 16}:{c & 0xFFFF}" for c in comm_attr.communities]
                    # Extended Communities
                    elif 'ExtendedCommunitiesAttribute' in type_url:
                        ec_attr = attribute_pb2.ExtendedCommunitiesAttribute()
                        pattr_any.Unpack(ec_attr)
                        ext_comms = []
                        for ec_bytes in ec_attr.communities:
                            # Parse extended community (8 bytes)
                            if len(ec_bytes) == 8:
                                type_high = ec_bytes[0]
                                type_low = ec_bytes[1]
                                # Two-octet AS specific (0x00 0x02 = RT, 0x00 0x03 = SoO)
                                if type_high == 0x00:
                                    asn = int.from_bytes(ec_bytes[2:4], 'big')
                                    local_admin = int.from_bytes(ec_bytes[4:8], 'big')
                                    if type_low == 0x02:
                                        ext_comms.append(f"rt {asn}:{local_admin}")
                                    elif type_low == 0x03:
                                        ext_comms.append(f"soo {asn}:{local_admin}")
                                    else:
                                        ext_comms.append(f"ext {asn}:{local_admin}")
                        if ext_comms:
                            attrs['extended_communities'] = ext_comms
                    # MED
                    elif 'MultiExitDiscAttribute' in type_url:
                        med_attr = attribute_pb2.MultiExitDiscAttribute()
                        pattr_any.Unpack(med_attr)
                        attrs['med'] = med_attr.med
                    # Origin
                    elif 'OriginAttribute' in type_url:
                        origin_attr = attribute_pb2.OriginAttribute()
                        pattr_any.Unpack(origin_attr)
                        attrs['origin'] = origin_attr.origin

            # Store neighbor IP if available
            if hasattr(path, 'neighbor_ip') and path.neighbor_ip:
                attrs['neighbor_ip'] = path.neighbor_ip

            # Store best path flag
            attrs['best'] = path.best if hasattr(path, 'best') else False

        return {
            'prefix': prefix,
            'attributes': attrs
        }

    def get_neighbor(self, address):
        """
        Get a single BGP neighbor by address

        Args:
            address: Neighbor IP address

        Returns:
            Peer object or raises PeerNotFound
        """
        request = gobgp.ListPeerRequest(address=address)

        try:
            for peer in self.stub.ListPeer(request):
                if peer.peer.conf.neighbor_address == address:
                    return peer.peer
        except grpc.RpcError:
            pass

        raise PeerNotFound(f"BGP Neighbor {address} is not in the BGP peer list")

    def get_all_neighbors(self):
        """
        Get all BGP neighbors

        Returns:
            List of peer objects
        """
        request = gobgp.ListPeerRequest()
        peers = []

        try:
            for peer in self.stub.ListPeer(request):
                peers.append(peer.peer)
        except grpc.RpcError as e:
            print(f"gRPC error getting neighbors: {e}")

        return peers

    def get_advertised_routes(self, neighbor_address, family=None):
        """
        Get routes advertised to a specific BGP neighbor

        Args:
            neighbor_address: Neighbor IP address
            family: Address family (default: IPv4 unicast)

        Returns:
            List of routes with parsed attributes
        """
        if family is None:
            # IPv4 unicast
            family = gobgp.Family(
                afi=gobgp.Family.AFI_IP,
                safi=gobgp.Family.SAFI_UNICAST
            )

        # ADJ_OUT table shows routes we're advertising to the neighbor
        request = gobgp.ListPathRequest(
            table_type=gobgp.ADJ_OUT,
            family=family,
            name=neighbor_address  # Specify which neighbor
        )

        routes = []
        try:
            for response in self.stub.ListPath(request):
                route = self._parse_path(response)
                if route:
                    routes.append(route)
        except grpc.RpcError as e:
            print(f"gRPC error getting advertised routes: {e}")

        return routes

    def add_neighbor(self, neighbor_address, peer_as, router_id=None, local_as=None,
                     afi_safis=None, enable_flowspec=True):
        """
        Add a new BGP neighbor

        Args:
            neighbor_address: Neighbor IP address
            peer_as: Peer AS number
            router_id: Optional router ID (unused in v3 - router ID is global)
            local_as: Optional local AS
            afi_safis: Optional list of address families to enable (e.g., ['ipv4-unicast', 'ipv4-flowspec'])
                       If not specified and enable_flowspec=True, enables ipv4-unicast and ipv4-flowspec
            enable_flowspec: If True (default), automatically enables ipv4-flowspec address family
        """
        # v3 uses peer_asn, local_asn instead of peer_as, local_as
        peer_conf = gobgp.PeerConf(
            neighbor_address=neighbor_address,
            peer_asn=peer_as  # v3 field name
        )

        # Note: router_id parameter is ignored in v3 - router ID is a global setting
        if local_as:
            peer_conf.local_asn = local_as  # v3 field name

        # Build AfiSafi configurations
        afi_safi_list = []

        if afi_safis:
            # User specified explicit address families
            for af in afi_safis:
                afi_safi = self._create_afi_safi(af)
                if afi_safi:
                    afi_safi_list.append(afi_safi)
        else:
            # Default: IPv4 Unicast + FlowSpec (if enabled)
            # IPv4 Unicast
            ipv4_unicast = gobgp.AfiSafi(
                config=gobgp.AfiSafiConfig(
                    family=gobgp.Family(
                        afi=gobgp.Family.AFI_IP,
                        safi=gobgp.Family.SAFI_UNICAST
                    ),
                    enabled=True
                )
            )
            afi_safi_list.append(ipv4_unicast)

            # IPv4 FlowSpec (if enabled)
            if enable_flowspec:
                ipv4_flowspec = gobgp.AfiSafi(
                    config=gobgp.AfiSafiConfig(
                        family=gobgp.Family(
                            afi=gobgp.Family.AFI_IP,
                            safi=gobgp.Family.SAFI_FLOW_SPEC_UNICAST
                        ),
                        enabled=True
                    )
                )
                afi_safi_list.append(ipv4_flowspec)

        peer = gobgp.Peer(conf=peer_conf, afi_safis=afi_safi_list)
        request = gobgp.AddPeerRequest(peer=peer)

        try:
            self.stub.AddPeer(request)
        except grpc.RpcError as e:
            print(f"gRPC error adding neighbor: {e}")
            raise

    def _create_afi_safi(self, family_name):
        """
        Create an AfiSafi object from a family name string

        Args:
            family_name: String like 'ipv4-unicast', 'ipv4-flowspec', 'ipv6-unicast', etc.

        Returns:
            AfiSafi object or None if invalid
        """
        family_map = {
            'ipv4-unicast': (gobgp.Family.AFI_IP, gobgp.Family.SAFI_UNICAST),
            'ipv4-multicast': (gobgp.Family.AFI_IP, gobgp.Family.SAFI_MULTICAST),
            'ipv4-flowspec': (gobgp.Family.AFI_IP, gobgp.Family.SAFI_FLOW_SPEC_UNICAST),
            'ipv6-unicast': (gobgp.Family.AFI_IP6, gobgp.Family.SAFI_UNICAST),
            'ipv6-multicast': (gobgp.Family.AFI_IP6, gobgp.Family.SAFI_MULTICAST),
            'ipv6-flowspec': (gobgp.Family.AFI_IP6, gobgp.Family.SAFI_FLOW_SPEC_UNICAST),
            'l2vpn-evpn': (gobgp.Family.AFI_L2VPN, gobgp.Family.SAFI_EVPN),
        }

        family_tuple = family_map.get(family_name.lower())
        if not family_tuple:
            print(f"Unknown address family: {family_name}")
            return None

        return gobgp.AfiSafi(
            config=gobgp.AfiSafiConfig(
                family=gobgp.Family(
                    afi=family_tuple[0],
                    safi=family_tuple[1]
                ),
                enabled=True
            )
        )

    def update_neighbor(self, neighbor_address, afi_safis=None, enable_flowspec=True,
                        do_soft_reset=True):
        """
        Update an existing BGP neighbor's configuration (e.g., to add FlowSpec support)

        Args:
            neighbor_address: Neighbor IP address
            afi_safis: Optional list of address families to enable (e.g., ['ipv4-unicast', 'ipv4-flowspec'])
            enable_flowspec: If True (default), adds ipv4-flowspec address family
            do_soft_reset: If True (default), perform soft reset to apply changes

        Returns:
            True if update was successful
        """
        # First get the current peer configuration
        try:
            current_peer = self.get_neighbor(neighbor_address)
        except Exception as e:
            print(f"Could not find peer {neighbor_address}: {e}")
            raise

        # Build new AfiSafi configurations
        afi_safi_list = []

        if afi_safis:
            # User specified explicit address families
            for af in afi_safis:
                afi_safi = self._create_afi_safi(af)
                if afi_safi:
                    afi_safi_list.append(afi_safi)
        else:
            # Default: IPv4 Unicast + FlowSpec (if enabled)
            # IPv4 Unicast
            ipv4_unicast = gobgp.AfiSafi(
                config=gobgp.AfiSafiConfig(
                    family=gobgp.Family(
                        afi=gobgp.Family.AFI_IP,
                        safi=gobgp.Family.SAFI_UNICAST
                    ),
                    enabled=True
                )
            )
            afi_safi_list.append(ipv4_unicast)

            # IPv4 FlowSpec (if enabled)
            if enable_flowspec:
                ipv4_flowspec = gobgp.AfiSafi(
                    config=gobgp.AfiSafiConfig(
                        family=gobgp.Family(
                            afi=gobgp.Family.AFI_IP,
                            safi=gobgp.Family.SAFI_FLOW_SPEC_UNICAST
                        ),
                        enabled=True
                    )
                )
                afi_safi_list.append(ipv4_flowspec)

        # Create updated peer with same conf but new afi_safis
        updated_peer = gobgp.Peer(
            conf=current_peer.conf,
            afi_safis=afi_safi_list
        )

        request = gobgp.UpdatePeerRequest(
            peer=updated_peer,
            do_soft_reset_in=do_soft_reset
        )

        try:
            response = self.stub.UpdatePeer(request)
            if response.needs_soft_reset_in and do_soft_reset:
                print(f"Peer {neighbor_address} updated, soft reset performed")
            return True
        except grpc.RpcError as e:
            print(f"gRPC error updating neighbor: {e}")
            raise

    def delete_neighbor(self, address):
        """
        Delete a BGP neighbor

        Args:
            address: Neighbor IP address
        """
        request = gobgp.DeletePeerRequest(address=address)

        try:
            self.stub.DeletePeer(request)
        except grpc.RpcError as e:
            print(f"gRPC error deleting neighbor: {e}")
            raise

    def advertise_route(self, prefix, next_hop, attributes=None):
        """
        Advertise a route to BGP neighbors

        Args:
            prefix: CIDR prefix (e.g., "10.0.0.0/24")
            next_hop: Next hop IP address
            attributes: Optional dict of BGP attributes
                - as_path: List of AS numbers
                - communities: List of community strings (e.g., ["65000:100"])
                - extended_communities: List of extended communities (e.g., ["rt 65000:100", "soo 65000:200"])
                - med: Multi-Exit Discriminator (int)
                - local_pref: Local Preference (int)
                - origin: Origin type (0=IGP, 1=EGP, 2=INCOMPLETE)
        """
        from google.protobuf import any_pb2
        from pygobgp.api import attribute_pb2

        # Parse prefix
        network, prefixlen = prefix.split('/')
        prefixlen = int(prefixlen)

        # Build NLRI
        nlri_msg = attribute_pb2.IPAddressPrefix(
            prefix_len=prefixlen,
            prefix=network
        )

        # Pack NLRI into Any
        nlri_any = any_pb2.Any()
        nlri_any.Pack(nlri_msg)

        # Build path attributes
        pattrs = []

        # Origin (default: IGP = 0, EGP = 1, INCOMPLETE = 2)
        origin_val = attributes.get('origin', 0) if attributes else 0
        origin_attr = attribute_pb2.OriginAttribute(origin=origin_val)
        origin_any = any_pb2.Any()
        origin_any.Pack(origin_attr)
        pattrs.append(origin_any)

        # Next hop
        nh_attr = attribute_pb2.NextHopAttribute(next_hop=next_hop)
        nh_any = any_pb2.Any()
        nh_any.Pack(nh_attr)
        pattrs.append(nh_any)

        # Optional attributes
        if attributes:
            # AS path
            if 'as_path' in attributes:
                segment = attribute_pb2.AsSegment(
                    type=2,  # AS_SEQUENCE
                    numbers=attributes['as_path']
                )
                as_attr = attribute_pb2.AsPathAttribute(segments=[segment])
                as_any = any_pb2.Any()
                as_any.Pack(as_attr)
                pattrs.append(as_any)

            # Communities
            if 'communities' in attributes:
                communities = []
                for comm in attributes['communities']:
                    if ':' in str(comm):
                        high, low = map(int, str(comm).split(':'))
                        communities.append((high << 16) | low)
                    else:
                        communities.append(int(comm))
                comm_attr = attribute_pb2.CommunitiesAttribute(communities=communities)
                comm_any = any_pb2.Any()
                comm_any.Pack(comm_attr)
                pattrs.append(comm_any)

            # Extended Communities (RT, SoO, etc.)
            if 'extended_communities' in attributes:
                ext_communities = []
                for ext_comm in attributes['extended_communities']:
                    # Parse extended community format: "rt 65000:100" or "soo 65000:200"
                    if isinstance(ext_comm, str):
                        parts = ext_comm.split()
                        if len(parts) == 2:
                            ec_type, ec_value = parts
                            if ':' in ec_value:
                                asn, local_admin = map(int, ec_value.split(':'))
                                # Build extended community bytes (8 bytes total)
                                # Type high byte, Type low byte, Value (6 bytes)
                                if ec_type.lower() == 'rt':
                                    # Route Target: Type 0x00 0x02
                                    ec_bytes = bytes([0x00, 0x02]) + asn.to_bytes(2, 'big') + local_admin.to_bytes(4, 'big')
                                elif ec_type.lower() == 'soo':
                                    # Site of Origin: Type 0x00 0x03
                                    ec_bytes = bytes([0x00, 0x03]) + asn.to_bytes(2, 'big') + local_admin.to_bytes(4, 'big')
                                else:
                                    # Generic two-octet AS specific: Type 0x00 0x02
                                    ec_bytes = bytes([0x00, 0x02]) + asn.to_bytes(2, 'big') + local_admin.to_bytes(4, 'big')
                                ext_communities.append(ec_bytes)

                if ext_communities:
                    # Create ExtendedCommunitiesAttribute
                    ec_attr = attribute_pb2.ExtendedCommunitiesAttribute(communities=ext_communities)
                    ec_any = any_pb2.Any()
                    ec_any.Pack(ec_attr)
                    pattrs.append(ec_any)

            # MED
            if 'med' in attributes:
                med_attr = attribute_pb2.MultiExitDiscAttribute(med=attributes['med'])
                med_any = any_pb2.Any()
                med_any.Pack(med_attr)
                pattrs.append(med_any)

            # Local Preference
            if 'local_pref' in attributes:
                lp_attr = attribute_pb2.LocalPrefAttribute(local_pref=attributes['local_pref'])
                lp_any = any_pb2.Any()
                lp_any.Pack(lp_attr)
                pattrs.append(lp_any)

        # Build path
        path = gobgp.Path(
            nlri=nlri_any,
            pattrs=pattrs,
            family=gobgp.Family(
                afi=gobgp.Family.AFI_IP,
                safi=gobgp.Family.SAFI_UNICAST
            )
        )

        # Add path
        request = gobgp.AddPathRequest(
            table_type=gobgp.GLOBAL,
            path=path
        )

        try:
            self.stub.AddPath(request)
        except grpc.RpcError as e:
            print(f"gRPC error advertising route: {e}")
            raise

    def withdraw_route(self, prefix):
        """
        Withdraw a route from BGP neighbors

        Args:
            prefix: CIDR prefix (e.g., "10.0.0.0/24")
        """
        from google.protobuf import any_pb2
        from pygobgp.api import attribute_pb2

        # Parse prefix
        network, prefixlen = prefix.split('/')
        prefixlen = int(prefixlen)

        # Build NLRI
        nlri_msg = attribute_pb2.IPAddressPrefix(
            prefix_len=prefixlen,
            prefix=network
        )

        # Pack NLRI into Any
        nlri_any = any_pb2.Any()
        nlri_any.Pack(nlri_msg)

        # Build path with is_withdraw flag
        path = gobgp.Path(
            nlri=nlri_any,
            is_withdraw=True,
            family=gobgp.Family(
                afi=gobgp.Family.AFI_IP,
                safi=gobgp.Family.SAFI_UNICAST
            )
        )

        # Delete path
        request = gobgp.DeletePathRequest(
            table_type=gobgp.GLOBAL,
            path=path
        )

        try:
            self.stub.DeletePath(request)
        except grpc.RpcError as e:
            print(f"gRPC error withdrawing route: {e}")
            raise

    def add_flowspec_rule(self, family='ipv4', rules=None, actions=None):
        """
        Add a FlowSpec rule for traffic filtering

        Args:
            family: Address family ('ipv4' or 'ipv6', default: 'ipv4')
            rules: Dict of match conditions:
                - destination: str (CIDR prefix, e.g., "192.0.2.0/24")
                - source: str (CIDR prefix)
                - protocol: int (IP protocol number, e.g., 6=TCP, 17=UDP)
                - port: int or list (port or port range)
                - destination_port: int or list
                - source_port: int or list
                - icmp_type: int
                - icmp_code: int
                - tcp_flags: dict (e.g., {"match": ["syn"], "not": ["ack"]})
                - packet_length: int or list
                - dscp: int
                - fragment: str ("dont-fragment", "is-fragment", "first-fragment", "last-fragment")
            actions: Dict of actions to take:
                - action: str ("accept", "discard", "rate-limit", "redirect", "mark")
                - rate: float (Mbps, for rate-limit action)
                - rate_asn: int (ASN for rate-limit, optional)
                - redirect_rt: str (Route Target for redirect, e.g., "65000:100")
                - community: list (Communities to mark)
                - sample: bool (Enable sampling)

        Returns:
            None

        Example:
            # Block TCP port 80 traffic to 192.0.2.0/24
            client.add_flowspec_rule(
                rules={
                    "destination": "192.0.2.0/24",
                    "protocol": 6,  # TCP
                    "destination_port": 80
                },
                actions={"action": "discard"}
            )

            # Rate-limit UDP traffic to 10 Mbps
            client.add_flowspec_rule(
                rules={
                    "destination": "10.0.0.0/8",
                    "protocol": 17  # UDP
                },
                actions={"action": "rate-limit", "rate": 10.0}
            )
        """
        from google.protobuf import any_pb2
        from pygobgp.api import attribute_pb2

        if rules is None:
            rules = {}
        if actions is None:
            actions = {}

        # Determine address family
        if family == 'ipv4':
            afi = gobgp.Family.AFI_IP
            safi = gobgp.Family.SAFI_FLOW_SPEC_UNICAST
        elif family == 'ipv6':
            afi = gobgp.Family.AFI_IP6
            safi = gobgp.Family.SAFI_FLOW_SPEC_UNICAST
        else:
            raise ValueError(f"Unsupported family: {family}")

        family_obj = gobgp.Family(afi=afi, safi=safi)

        # Build FlowSpec NLRI rules
        nlri_rules = []

        # Destination prefix (type 1)
        if 'destination' in rules:
            prefix, prefixlen = rules['destination'].split('/')
            dest_rule = attribute_pb2.FlowSpecIPPrefix(
                type=1,
                prefix_len=int(prefixlen),
                prefix=prefix
            )
            dest_any = any_pb2.Any()
            dest_any.Pack(dest_rule)
            nlri_rules.append(dest_any)

        # Source prefix (type 2)
        if 'source' in rules:
            prefix, prefixlen = rules['source'].split('/')
            src_rule = attribute_pb2.FlowSpecIPPrefix(
                type=2,
                prefix_len=int(prefixlen),
                prefix=prefix
            )
            src_any = any_pb2.Any()
            src_any.Pack(src_rule)
            nlri_rules.append(src_any)

        # Protocol (type 3)
        if 'protocol' in rules:
            proto_item = attribute_pb2.FlowSpecComponentItem(
                op=0x81,  # 0x81 = end-of-list (0x80) + equals (0x01)
                value=rules['protocol']
            )
            proto_rule = attribute_pb2.FlowSpecComponent(
                type=3,
                items=[proto_item]
            )
            proto_any = any_pb2.Any()
            proto_any.Pack(proto_rule)
            nlri_rules.append(proto_any)

        # Port (type 4) - any port
        if 'port' in rules:
            port_val = rules['port'] if isinstance(rules['port'], int) else rules['port'][0]
            port_item = attribute_pb2.FlowSpecComponentItem(op=0x81, value=port_val)
            port_rule = attribute_pb2.FlowSpecComponent(type=4, items=[port_item])
            port_any = any_pb2.Any()
            port_any.Pack(port_rule)
            nlri_rules.append(port_any)

        # Destination Port (type 5)
        if 'destination_port' in rules:
            dport_val = rules['destination_port'] if isinstance(rules['destination_port'], int) else rules['destination_port'][0]
            dport_item = attribute_pb2.FlowSpecComponentItem(op=0x81, value=dport_val)
            dport_rule = attribute_pb2.FlowSpecComponent(type=5, items=[dport_item])
            dport_any = any_pb2.Any()
            dport_any.Pack(dport_rule)
            nlri_rules.append(dport_any)

        # Source Port (type 6)
        if 'source_port' in rules:
            sport_val = rules['source_port'] if isinstance(rules['source_port'], int) else rules['source_port'][0]
            sport_item = attribute_pb2.FlowSpecComponentItem(op=0x81, value=sport_val)
            sport_rule = attribute_pb2.FlowSpecComponent(type=6, items=[sport_item])
            sport_any = any_pb2.Any()
            sport_any.Pack(sport_rule)
            nlri_rules.append(sport_any)

        # ICMP Type (type 7)
        if 'icmp_type' in rules:
            icmp_type_item = attribute_pb2.FlowSpecComponentItem(op=0x81, value=rules['icmp_type'])
            icmp_type_rule = attribute_pb2.FlowSpecComponent(type=7, items=[icmp_type_item])
            icmp_type_any = any_pb2.Any()
            icmp_type_any.Pack(icmp_type_rule)
            nlri_rules.append(icmp_type_any)

        # ICMP Code (type 8)
        if 'icmp_code' in rules:
            icmp_code_item = attribute_pb2.FlowSpecComponentItem(op=0x81, value=rules['icmp_code'])
            icmp_code_rule = attribute_pb2.FlowSpecComponent(type=8, items=[icmp_code_item])
            icmp_code_any = any_pb2.Any()
            icmp_code_any.Pack(icmp_code_rule)
            nlri_rules.append(icmp_code_any)

        # Packet Length (type 10)
        if 'packet_length' in rules:
            pkt_len_val = rules['packet_length'] if isinstance(rules['packet_length'], int) else rules['packet_length'][0]
            pkt_len_item = attribute_pb2.FlowSpecComponentItem(op=0x81, value=pkt_len_val)
            pkt_len_rule = attribute_pb2.FlowSpecComponent(type=10, items=[pkt_len_item])
            pkt_len_any = any_pb2.Any()
            pkt_len_any.Pack(pkt_len_rule)
            nlri_rules.append(pkt_len_any)

        # DSCP (type 11)
        if 'dscp' in rules:
            dscp_item = attribute_pb2.FlowSpecComponentItem(op=0x81, value=rules['dscp'])
            dscp_rule = attribute_pb2.FlowSpecComponent(type=11, items=[dscp_item])
            dscp_any = any_pb2.Any()
            dscp_any.Pack(dscp_rule)
            nlri_rules.append(dscp_any)

        # Build FlowSpec NLRI
        flowspec_nlri = attribute_pb2.FlowSpecNLRI(rules=nlri_rules)
        nlri_any = any_pb2.Any()
        nlri_any.Pack(flowspec_nlri)

        # Build path attributes (extended communities for actions)
        pattrs = []

        if actions:
            ext_communities = []
            action_type = actions.get('action', 'accept')

            # Traffic Rate (rate-limit)
            if action_type == 'rate-limit':
                rate = actions.get('rate', 0.0)
                rate_asn = actions.get('rate_asn', 0)
                rate_ec = attribute_pb2.TrafficRateExtended(asn=rate_asn, rate=rate)
                rate_any = any_pb2.Any()
                rate_any.Pack(rate_ec)
                ext_communities.append(rate_any)

            # Traffic Action (discard, sample, terminal)
            if action_type in ['discard', 'accept']:
                terminal = (action_type == 'discard')
                sample = actions.get('sample', False)
                action_ec = attribute_pb2.TrafficActionExtended(terminal=terminal, sample=sample)
                action_any = any_pb2.Any()
                action_any.Pack(action_ec)
                ext_communities.append(action_any)

            # Redirect (RT-based redirect)
            if action_type == 'redirect' and 'redirect_rt' in actions:
                rt_parts = actions['redirect_rt'].split(':')
                if len(rt_parts) == 2:
                    asn = int(rt_parts[0])
                    local_admin = int(rt_parts[1])
                    redirect_ec = attribute_pb2.RedirectTwoOctetAsSpecificExtended(
                        asn=asn,
                        local_admin=local_admin
                    )
                    redirect_any = any_pb2.Any()
                    redirect_any.Pack(redirect_ec)
                    ext_communities.append(redirect_any)

            # Add extended communities attribute if we have any
            if ext_communities:
                ec_attr = attribute_pb2.ExtendedCommunitiesAttribute(communities=ext_communities)
                ec_attr_any = any_pb2.Any()
                ec_attr_any.Pack(ec_attr)
                pattrs.append(ec_attr_any)

        # Add origin attribute (required for all BGP routes)
        origin_attr = attribute_pb2.OriginAttribute(origin=0)  # 0 = IGP
        origin_any = any_pb2.Any()
        origin_any.Pack(origin_attr)
        pattrs.append(origin_any)

        # Add next-hop attribute (required for FlowSpec routes)
        # Use router's own IP as next-hop (GoBGP requires a valid/reachable next-hop)
        nexthop_attr = attribute_pb2.NextHopAttribute(next_hop="192.168.70.31")
        nexthop_any = any_pb2.Any()
        nexthop_any.Pack(nexthop_attr)
        pattrs.append(nexthop_any)

        # Build path
        path = gobgp.Path(
            nlri=nlri_any,
            pattrs=pattrs,
            family=family_obj
        )

        # Add FlowSpec rule
        request = gobgp.AddPathRequest(
            table_type=gobgp.GLOBAL,
            path=path
        )

        try:
            self.stub.AddPath(request)
        except grpc.RpcError as e:
            print(f"gRPC error adding FlowSpec rule: {e}")
            raise

    def delete_flowspec_rule(self, family='ipv4', rules=None):
        """
        Delete a FlowSpec rule

        Args:
            family: Address family ('ipv4' or 'ipv6', default: 'ipv4')
            rules: Dict of match conditions (same as add_flowspec_rule)
        """
        from google.protobuf import any_pb2
        from pygobgp.api import attribute_pb2

        if rules is None:
            rules = {}

        # Determine address family
        if family == 'ipv4':
            afi = gobgp.Family.AFI_IP
            safi = gobgp.Family.SAFI_FLOW_SPEC_UNICAST
        elif family == 'ipv6':
            afi = gobgp.Family.AFI_IP6
            safi = gobgp.Family.SAFI_FLOW_SPEC_UNICAST
        else:
            raise ValueError(f"Unsupported family: {family}")

        family_obj = gobgp.Family(afi=afi, safi=safi)

        # Build FlowSpec NLRI rules (same as add)
        nlri_rules = []

        # Destination prefix (type 1)
        if 'destination' in rules:
            prefix, prefixlen = rules['destination'].split('/')
            dest_rule = attribute_pb2.FlowSpecIPPrefix(
                type=1,
                prefix_len=int(prefixlen),
                prefix=prefix
            )
            dest_any = any_pb2.Any()
            dest_any.Pack(dest_rule)
            nlri_rules.append(dest_any)

        # Source prefix (type 2)
        if 'source' in rules:
            prefix, prefixlen = rules['source'].split('/')
            src_rule = attribute_pb2.FlowSpecIPPrefix(
                type=2,
                prefix_len=int(prefixlen),
                prefix=prefix
            )
            src_any = any_pb2.Any()
            src_any.Pack(src_rule)
            nlri_rules.append(src_any)

        # Protocol (type 3)
        if 'protocol' in rules:
            proto_item = attribute_pb2.FlowSpecComponentItem(op=0, value=rules['protocol'])
            proto_rule = attribute_pb2.FlowSpecComponent(type=3, items=[proto_item])
            proto_any = any_pb2.Any()
            proto_any.Pack(proto_rule)
            nlri_rules.append(proto_any)

        # Destination Port (type 5) - most common for deletion
        if 'destination_port' in rules:
            dport_val = rules['destination_port'] if isinstance(rules['destination_port'], int) else rules['destination_port'][0]
            dport_item = attribute_pb2.FlowSpecComponentItem(op=0, value=dport_val)
            dport_rule = attribute_pb2.FlowSpecComponent(type=5, items=[dport_item])
            dport_any = any_pb2.Any()
            dport_any.Pack(dport_rule)
            nlri_rules.append(dport_any)

        # Build FlowSpec NLRI
        flowspec_nlri = attribute_pb2.FlowSpecNLRI(rules=nlri_rules)
        nlri_any = any_pb2.Any()
        nlri_any.Pack(flowspec_nlri)

        # Build path with is_withdraw flag
        path = gobgp.Path(
            nlri=nlri_any,
            is_withdraw=True,
            family=family_obj
        )

        # Delete FlowSpec rule
        request = gobgp.DeletePathRequest(
            table_type=gobgp.GLOBAL,
            path=path
        )

        try:
            self.stub.DeletePath(request)
        except grpc.RpcError as e:
            print(f"gRPC error deleting FlowSpec rule: {e}")
            raise

    def get_flowspec_rules(self, family='ipv4'):
        """
        Get all FlowSpec rules

        Args:
            family: Address family ('ipv4' or 'ipv6', default: 'ipv4')

        Returns:
            List of FlowSpec rules
        """
        # Determine address family
        if family == 'ipv4':
            afi = gobgp.Family.AFI_IP
            safi = gobgp.Family.SAFI_FLOW_SPEC_UNICAST
        elif family == 'ipv6':
            afi = gobgp.Family.AFI_IP6
            safi = gobgp.Family.SAFI_FLOW_SPEC_UNICAST
        else:
            raise ValueError(f"Unsupported family: {family}")

        family_obj = gobgp.Family(afi=afi, safi=safi)

        request = gobgp.ListPathRequest(
            table_type=gobgp.GLOBAL,
            family=family_obj
        )

        rules = []
        try:
            for response in self.stub.ListPath(request):
                rule = self._parse_flowspec_path(response)
                if rule:
                    rules.append(rule)
        except grpc.RpcError as e:
            print(f"gRPC error getting FlowSpec rules: {e}")

        return rules

    def _parse_flowspec_path(self, path_response):
        """Parse a FlowSpec path response into a friendly dict"""
        from pygobgp.api import attribute_pb2

        if not path_response or not path_response.destination:
            return None

        dest = path_response.destination

        # Parse FlowSpec NLRI
        rule_conditions = {}

        if dest.paths:
            path = dest.paths[0]

            # Try to parse NLRI as FlowSpec
            try:
                flowspec_nlri = attribute_pb2.FlowSpecNLRI()
                path.nlri.Unpack(flowspec_nlri)

                for rule_any in flowspec_nlri.rules:
                    type_url = rule_any.type_url

                    # IP Prefix rules
                    if 'FlowSpecIPPrefix' in type_url:
                        ip_prefix = attribute_pb2.FlowSpecIPPrefix()
                        rule_any.Unpack(ip_prefix)
                        prefix_str = f"{ip_prefix.prefix}/{ip_prefix.prefix_len}"
                        if ip_prefix.type == 1:
                            rule_conditions['destination'] = prefix_str
                        elif ip_prefix.type == 2:
                            rule_conditions['source'] = prefix_str

                    # Component rules
                    elif 'FlowSpecComponent' in type_url:
                        component = attribute_pb2.FlowSpecComponent()
                        rule_any.Unpack(component)

                        if component.items:
                            value = component.items[0].value

                            if component.type == 3:
                                rule_conditions['protocol'] = value
                            elif component.type == 4:
                                rule_conditions['port'] = value
                            elif component.type == 5:
                                rule_conditions['destination_port'] = value
                            elif component.type == 6:
                                rule_conditions['source_port'] = value
                            elif component.type == 7:
                                rule_conditions['icmp_type'] = value
                            elif component.type == 8:
                                rule_conditions['icmp_code'] = value
                            elif component.type == 10:
                                rule_conditions['packet_length'] = value
                            elif component.type == 11:
                                rule_conditions['dscp'] = value
            except Exception as e:
                print(f"Error parsing FlowSpec NLRI: {e}")
                return None

            # Parse actions from extended communities
            actions = {}
            if path.pattrs:
                for pattr_any in path.pattrs:
                    type_url = pattr_any.type_url

                    if 'ExtendedCommunitiesAttribute' in type_url:
                        ec_attr = attribute_pb2.ExtendedCommunitiesAttribute()
                        pattr_any.Unpack(ec_attr)

                        for ec_any in ec_attr.communities:
                            ec_type_url = ec_any.type_url

                            # Traffic Rate (rate-limit)
                            if 'TrafficRateExtended' in ec_type_url:
                                rate_ec = attribute_pb2.TrafficRateExtended()
                                ec_any.Unpack(rate_ec)
                                actions['action'] = 'rate-limit'
                                actions['rate'] = rate_ec.rate
                                actions['rate_asn'] = rate_ec.asn

                            # Traffic Action (discard/accept)
                            elif 'TrafficActionExtended' in ec_type_url:
                                action_ec = attribute_pb2.TrafficActionExtended()
                                ec_any.Unpack(action_ec)
                                actions['action'] = 'discard' if action_ec.terminal else 'accept'
                                actions['sample'] = action_ec.sample

                            # Redirect
                            elif 'RedirectTwoOctetAsSpecificExtended' in ec_type_url:
                                redirect_ec = attribute_pb2.RedirectTwoOctetAsSpecificExtended()
                                ec_any.Unpack(redirect_ec)
                                actions['action'] = 'redirect'
                                actions['redirect_rt'] = f"{redirect_ec.asn}:{redirect_ec.local_admin}"

        return {
            'match': rule_conditions,
            'actions': actions
        }

    def add_bmp_server(self, address: str, port: int = 11019,
                      route_monitoring_policy: str = 'pre-policy',
                      statistics_timeout: int = 0,
                      route_mirroring_enabled: bool = False):
        """
        Add a BMP (BGP Monitoring Protocol) server for event-driven route monitoring.

        Args:
            address: BMP server IP address
            port: BMP server port (default: 11019)
            route_monitoring_policy: One of 'pre-policy', 'post-policy', 'both', 'local-rib', 'all'
            statistics_timeout: Statistics reporting interval in seconds (0 = disabled)
            route_mirroring_enabled: Enable route mirroring for debugging (not used in v3)
        """
        # Map policy string to enum value
        policy_map = {
            'pre-policy': 0,  # PRE
            'post-policy': 1,  # POST
            'both': 2,  # BOTH
            'local-rib': 3,  # LOCAL
            'all': 4  # ALL
        }

        policy_value = policy_map.get(route_monitoring_policy.lower(), 0)

        request = gobgp.AddBmpRequest(
            address=address,
            port=port,
            policy=policy_value,
            StatisticsTimeout=statistics_timeout
        )

        try:
            self.stub.AddBmp(request)
        except grpc.RpcError as e:
            print(f"gRPC error adding BMP server: {e}")
            raise

    def delete_bmp_server(self, address: str, port: int = 11019):
        """
        Delete a BMP server.

        Args:
            address: BMP server IP address
            port: BMP server port (default: 11019)
        """
        request = gobgp.DeleteBmpRequest(
            address=address,
            port=port
        )

        try:
            self.stub.DeleteBmp(request)
        except grpc.RpcError as e:
            print(f"gRPC error deleting BMP server: {e}")
            raise

    def list_bmp_servers(self):
        """
        List all configured BMP servers.

        Returns:
            List of BMP server configurations
        """
        request = gobgp.ListBmpRequest()

        servers = []
        try:
            for response in self.stub.ListBmp(request):
                # Parse BMP server info from response
                if hasattr(response, 'conf'):
                    conf = response.conf
                    server = {
                        'address': conf.address if hasattr(conf, 'address') else '',
                        'port': conf.port if hasattr(conf, 'port') else 11019,
                        'policy': conf.policy if hasattr(conf, 'policy') else 0
                    }
                    servers.append(server)
        except grpc.RpcError as e:
            print(f"gRPC error listing BMP servers: {e}")

        return servers


# Maintain backward compatibility
Neighbor = gobgp.Peer
