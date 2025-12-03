"""
Event-Driven Routing with Webhooks
Handles BGP events and triggers webhooks for automation
"""

import threading
import requests
import logging
from typing import List, Callable, Dict
from datetime import datetime

logger = logging.getLogger(__name__)


class EventWebhookManager:
    """
    Manages event webhooks for BGP event-driven routing decisions.

    When BGP events occur (peer up/down, route changes), this manager:
    1. Receives events from GoBGP WatchEvent stream
    2. Filters events based on configuration
    3. POSTs events to configured webhook URLs
    4. Executes custom callback functions
    """

    def __init__(self):
        self.webhooks: List[Dict] = []
        self.callbacks: List[Callable] = []
        self.event_watcher_thread = None
        self.is_running = False

    def add_webhook(self, url: str, events: List[str] = None, peer_filter: str = None, enabled: bool = True):
        """
        Add a webhook URL to receive BGP events.

        Args:
            url: Webhook URL to POST events to
            events: List of event types to monitor ('peer', 'table')
            peer_filter: Filter events for specific peer IP
            enabled: Enable/disable webhook
        """
        if events is None:
            events = ['peer', 'table']

        webhook = {
            'url': url,
            'events': events,
            'peer_filter': peer_filter,
            'enabled': enabled,
            'created_at': datetime.utcnow().isoformat()
        }

        self.webhooks.append(webhook)
        logger.info(f"[Event Webhook] Added webhook: {url} for events {events}")

    def remove_webhook(self, url: str):
        """Remove a webhook by URL"""
        self.webhooks = [w for w in self.webhooks if w['url'] != url]
        logger.info(f"[Event Webhook] Removed webhook: {url}")

    def list_webhooks(self) -> List[Dict]:
        """List all configured webhooks"""
        return self.webhooks

    def add_callback(self, callback: Callable):
        """
        Add a custom Python callback function for events.

        The callback will receive an event dict with keys:
        - 'type': 'peer' or 'table'
        - 'peer': {...} (for peer events)
        - 'paths': [...] (for table events)
        """
        self.callbacks.append(callback)
        logger.info(f"[Event Callback] Added custom callback: {callback.__name__}")

    def handle_event(self, event: Dict):
        """
        Handle incoming BGP event.

        This method is called by the event watcher for each event.
        It filters and distributes events to webhooks and callbacks.
        """
        if not event:
            return

        event_type = event.get('type')
        logger.debug(f"[Event Handler] Processing event type: {event_type}")

        # Add timestamp
        event['timestamp'] = datetime.utcnow().isoformat()

        # Send to webhooks
        for webhook in self.webhooks:
            if not webhook['enabled']:
                continue

            # Filter by event type
            if event_type not in webhook['events']:
                continue

            # Filter by peer (if specified)
            if webhook['peer_filter']:
                if event_type == 'peer':
                    peer_address = event.get('peer', {}).get('address')
                    if peer_address != webhook['peer_filter']:
                        continue

            # Send webhook
            try:
                self._send_webhook(webhook['url'], event)
            except Exception as e:
                logger.error(f"[Event Webhook] Failed to send webhook to {webhook['url']}: {e}")

        # Execute callbacks
        for callback in self.callbacks:
            try:
                callback(event)
            except Exception as e:
                logger.error(f"[Event Callback] Error in callback {callback.__name__}: {e}")

    def _send_webhook(self, url: str, event: Dict):
        """Send HTTP POST to webhook URL"""
        try:
            response = requests.post(
                url,
                json=event,
                headers={'Content-Type': 'application/json'},
                timeout=5
            )

            if response.status_code < 300:
                logger.debug(f"[Event Webhook] Sent event to {url}: {response.status_code}")
            else:
                logger.warning(f"[Event Webhook] Webhook returned {response.status_code}: {response.text}")

        except requests.exceptions.Timeout:
            logger.error(f"[Event Webhook] Timeout sending to {url}")
        except requests.exceptions.RequestException as e:
            logger.error(f"[Event Webhook] Request error to {url}: {e}")

    def start(self, gobgp_manager, peer_address=None, table_type=None):
        """
        Start the event watcher in a background thread.

        Args:
            gobgp_manager: GoBGP manager instance
            peer_address: Optional - filter events for specific peer
            table_type: Optional - filter events for specific table type
        """
        if self.is_running:
            logger.warning("[Event Watcher] Already running")
            return

        self.is_running = True

        def watch_events():
            try:
                logger.info("[Event Watcher] Starting event monitoring thread...")
                gobgp_manager.start_event_watcher(
                    callback=self.handle_event,
                    peer_address=peer_address,
                    table_type=table_type
                )
            except Exception as e:
                logger.exception("[Event Watcher] Event watcher thread stopped with error")
                self.is_running = False

        self.event_watcher_thread = threading.Thread(target=watch_events, daemon=True)
        self.event_watcher_thread.start()
        logger.info("[Event Watcher] Event monitoring thread started")

    def stop(self):
        """Stop the event watcher"""
        if not self.is_running:
            return

        self.is_running = False
        logger.info("[Event Watcher] Stopping event monitoring...")


# Global event webhook manager
event_webhook_manager = EventWebhookManager()


# Example callback for event-driven routing decisions
def example_route_policy_callback(event: Dict):
    """
    Example callback demonstrating event-driven routing decisions.

    This can be customized to:
    - Automatically add/remove routes based on peer state
    - Trigger FlowSpec rules when specific routes appear
    - Update route policies dynamically
    - Send alerts to monitoring systems
    """
    event_type = event.get('type')

    if event_type == 'peer':
        # Peer state change
        peer = event.get('peer', {})
        address = peer.get('address')
        state = peer.get('state')

        logger.info(f"[Route Policy] Peer {address} changed state to {state}")

        # Example: If peer goes down, withdraw all routes
        # if state == 1:  # PEER_DOWN
        #     logger.info(f"[Route Policy] Peer {address} is down - triggering route withdrawal")

    elif event_type == 'table':
        # Route update
        paths = event.get('paths', [])

        for path in paths:
            is_withdraw = path.get('is_withdraw', False)
            nlri = path.get('nlri')

            if is_withdraw:
                logger.info(f"[Route Policy] Route withdrawn: {nlri}")
            else:
                logger.info(f"[Route Policy] Route added: {nlri}")

            # Example: Trigger FlowSpec rule for specific prefixes
            # if '10.0.0.0/8' in str(nlri) and not is_withdraw:
            #     logger.info(f"[Route Policy] Detected 10.0.0.0/8 - triggering FlowSpec rule")
