// NetStream Instructions Dialog
import { useState } from "react";
import styles from "./InstructionsDialog.module.css";
import { Button } from "../ui";

export default function InstructionsDialog({ open, onClose, tourMode = false, onStartTour }) {
  const [activeSection, setActiveSection] = useState("welcome");

  if (!open) return null;

  const sections = [
    { id: "welcome", label: "Welcome", emoji: "👋" },
    { id: "lab", label: "Lab Manager", emoji: "🔬" },
    { id: "bgp", label: "BGP Control", emoji: "🌐" },
    { id: "monitoring", label: "Monitoring", emoji: "📊" },
    { id: "testing", label: "Network Testing", emoji: "🧪" },
    { id: "topology", label: "Topologies", emoji: "🗺️" },
    { id: "shortcuts", label: "Shortcuts", emoji: "⌨️" },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case "welcome":
        return (
          <div className={styles.sectionContent}>
            <h2>
              <span className={styles.emoji}>👋</span> Welcome to NetStream
            </h2>
            <p>
              NetStream is a comprehensive BGP lab and network testing platform for building
              and managing network topologies with multiple BGP implementations (GoBGP, FRR, ExaBGP)
              and testing network connectivity with NetKnight.
            </p>

            <h3>Quick Start</h3>
            <ol>
              <li>Create BGP daemons using the Lab Manager (/bgp)</li>
              <li>Configure neighbors and routing policies</li>
              <li>Monitor routes with BMP and NetFlow</li>
              <li>Test FlowSpec rules for traffic filtering</li>
              <li>Run network tests with NetKnight hosts</li>
            </ol>

            <h3>Key Features</h3>
            <ul>
              <li><strong>Multi-Implementation Support:</strong> GoBGP, FRR, ExaBGP</li>
              <li><strong>Embedded APIs:</strong> Each daemon has its own REST API</li>
              <li><strong>Real-time Monitoring:</strong> BMP and NetFlow support</li>
              <li><strong>FlowSpec:</strong> Network traffic filtering</li>
              <li><strong>Network Testing:</strong> iperf3, ping, HTTP server/client</li>
              <li><strong>Topology Management:</strong> Save and load network configurations</li>
            </ul>

            <div className={styles.tip}>
              <strong>💡 Tip:</strong> Press <kbd>?</kbd> at any time to open this help dialog.
            </div>
          </div>
        );

      case "lab":
        return (
          <div className={styles.sectionContent}>
            <h2>
              <span className={styles.emoji}>🔬</span> Lab Manager
            </h2>

            <h3>Creating BGP Daemons</h3>
            <p>
              Go to <strong>/bgp</strong> and use the Lab Manager to create daemon containers:
            </p>
            <ul>
              <li><strong>GoBGP</strong> - Modern BGP implementation in Go with Python API</li>
              <li><strong>FRR</strong> - Free Range Routing suite with vtysh CLI</li>
              <li><strong>ExaBGP</strong> - Python-based BGP implementation</li>
            </ul>

            <h3>Configure Each Daemon</h3>
            <p>Each daemon runs with its own embedded unified API. Configure:</p>
            <ul>
              <li><strong>ASN</strong> - Autonomous System Number (e.g., 65001)</li>
              <li><strong>Router ID</strong> - BGP router identifier (e.g., 1.1.1.1)</li>
              <li><strong>IP Address</strong> - Container IP in lab network</li>
              <li><strong>API Port</strong> - REST API port (e.g., 55000)</li>
            </ul>

            <h3>Creating NetKnight Hosts</h3>
            <p>
              Host containers provide network testing capabilities:
            </p>
            <ul>
              <li>iperf3 server/client for bandwidth testing</li>
              <li>ping and traceroute for connectivity testing</li>
              <li>HTTP server/client for application testing</li>
              <li>Traffic generation and analysis</li>
            </ul>

            <h3>Network Topology</h3>
            <p>
              All containers connect to the lab network (<code>192.168.70.0/24</code>).
              Use the topology visualizer to see connections between routers and hosts.
            </p>
          </div>
        );

      case "bgp":
        return (
          <div className={styles.sectionContent}>
            <h2>
              <span className={styles.emoji}>🌐</span> BGP Control
            </h2>

            <h3>Managing Neighbors</h3>
            <p>
              Navigate to <strong>/connections</strong> to:
            </p>
            <ul>
              <li>Add BGP neighbors to establish peering sessions</li>
              <li>View neighbor status (Established, Idle, Active, etc.)</li>
              <li>Configure peer groups for easier management</li>
              <li>Set remote ASN and local preferences</li>
            </ul>

            <h3>Unified API Clients</h3>
            <p>
              Go to <strong>/environment</strong> to manage API connections:
            </p>
            <ul>
              <li>Connect to daemon APIs for centralized management</li>
              <li>Test API connectivity and health</li>
              <li>Auto-discover daemons from Lab Manager</li>
            </ul>

            <h3>Route Management</h3>
            <p>
              Visit <strong>/bgp/routes</strong> to:
            </p>
            <ul>
              <li>Advertise IPv4/IPv6 routes</li>
              <li>View routing table (RIB)</li>
              <li>Configure route policies and filters</li>
              <li>Set up prefix lists and community filters</li>
              <li>Manage route maps</li>
            </ul>

            <h3>FlowSpec Rules</h3>
            <p>
              FlowSpec allows network-layer traffic filtering:
            </p>
            <ul>
              <li>Create traffic filtering rules (DDoS mitigation)</li>
              <li>Match on source/destination IPs, ports, protocols</li>
              <li>Apply actions: discard, rate-limit, redirect</li>
              <li>View enforced FlowSpec rules across peers</li>
            </ul>

            <h3>Route Policies</h3>
            <p>
              Configure routing policies to control route advertisement:
            </p>
            <ul>
              <li>Accept/reject routes based on criteria</li>
              <li>Modify BGP attributes (AS-Path, MED, Local-Pref)</li>
              <li>Apply community tags</li>
            </ul>
          </div>
        );

      case "monitoring":
        return (
          <div className={styles.sectionContent}>
            <h2>
              <span className={styles.emoji}>📊</span> Monitoring
            </h2>

            <h3>BMP (BGP Monitoring Protocol)</h3>
            <p>
              Navigate to <strong>/bmp</strong> to monitor BGP sessions:
            </p>
            <ul>
              <li>View route advertisements in real-time</li>
              <li>Track peer state changes and convergence</li>
              <li>Monitor FlowSpec rules distribution</li>
              <li>See route attributes (AS-Path, communities, etc.)</li>
              <li>Export monitoring data for analysis</li>
            </ul>

            <h3>NetFlow Analysis</h3>
            <p>
              Go to <strong>/netflow</strong> for traffic flow analysis:
            </p>
            <ul>
              <li><strong>Flow Statistics:</strong> View total flows, packets, bytes</li>
              <li><strong>Top Talkers:</strong> Identify hosts with most traffic</li>
              <li><strong>Conversations:</strong> See source-to-destination traffic pairs</li>
              <li><strong>Protocol Distribution:</strong> Analyze traffic by protocol</li>
              <li><strong>Flow Triggers:</strong> Set up alerts for specific traffic patterns</li>
              <li><strong>Time-based Analysis:</strong> Filter flows by time range</li>
            </ul>

            <h3>APIs</h3>
            <p>
              NetStream exposes REST APIs for programmatic access:
            </p>
            <ul>
              <li><strong>:5010</strong> - Container Manager API (create/manage daemons)</li>
              <li><strong>:5002</strong> - Monitoring API (BMP + NetFlow unified)</li>
              <li><strong>:55xxx</strong> - Individual daemon APIs (BGP control per daemon)</li>
            </ul>

            <h3>API Call History</h3>
            <p>
              View all API calls in the footer for debugging:
            </p>
            <ul>
              <li>Request/response details</li>
              <li>Timing information</li>
              <li>Error tracking</li>
            </ul>
          </div>
        );

      case "testing":
        return (
          <div className={styles.sectionContent}>
            <h2>
              <span className={styles.emoji}>🧪</span> Network Testing (NetKnight)
            </h2>

            <h3>What is NetKnight?</h3>
            <p>
              NetKnight provides network testing capabilities through containerized hosts.
              Each host runs an API that controls various network testing tools.
            </p>

            <h3>Available Test Types</h3>

            <h4>🚀 iperf3 - Bandwidth Testing</h4>
            <ul>
              <li>TCP/UDP throughput testing</li>
              <li>Bidirectional bandwidth measurement</li>
              <li>Parallel streams support</li>
              <li>Measure jitter and packet loss</li>
            </ul>

            <h4>📡 Ping - Connectivity Testing</h4>
            <ul>
              <li>ICMP echo request/reply</li>
              <li>Measure latency (RTT)</li>
              <li>Test packet loss</li>
              <li>Continuous or count-based</li>
            </ul>

            <h4>🌐 HTTP - Application Testing</h4>
            <ul>
              <li>HTTP server (serve content)</li>
              <li>HTTP client (fetch content)</li>
              <li>Test application-layer connectivity</li>
              <li>Validate routing for web traffic</li>
            </ul>

            <h4>🔀 Traceroute - Path Discovery</h4>
            <ul>
              <li>Discover network path to destination</li>
              <li>Identify routing hops</li>
              <li>Diagnose routing issues</li>
            </ul>

            <h3>Running Tests</h3>
            <p>
              Navigate to <strong>/testing</strong> to:
            </p>
            <ul>
              <li>Select source and destination hosts</li>
              <li>Choose test type (iperf3, ping, HTTP, etc.)</li>
              <li>Configure test parameters</li>
              <li>View real-time results</li>
              <li>Save test history</li>
            </ul>

            <h3>Use Cases</h3>
            <ul>
              <li><strong>FlowSpec Validation:</strong> Test that traffic filtering works</li>
              <li><strong>Route Testing:</strong> Verify packets follow expected paths</li>
              <li><strong>Performance Baseline:</strong> Measure network capacity</li>
              <li><strong>Policy Validation:</strong> Ensure routing policies work correctly</li>
            </ul>
          </div>
        );

      case "topology":
        return (
          <div className={styles.sectionContent}>
            <h2>
              <span className={styles.emoji}>🗺️</span> Topology Management
            </h2>

            <h3>What are Topologies?</h3>
            <p>
              Topologies allow you to save and restore complete network configurations,
              including daemons, hosts, networks, and their relationships.
            </p>

            <h3>Features</h3>
            <p>
              Navigate to <strong>/topologies</strong> to:
            </p>
            <ul>
              <li><strong>Save Current State:</strong> Capture your current lab setup</li>
              <li><strong>Load Topology:</strong> Restore a previously saved configuration</li>
              <li><strong>Active Topology:</strong> Track which topology is running</li>
              <li><strong>Delete Topology:</strong> Remove saved configurations</li>
              <li><strong>Metadata:</strong> Name, description, creation date</li>
            </ul>

            <h3>What Gets Saved</h3>
            <p>
              A topology includes:
            </p>
            <ul>
              <li>All BGP daemons (GoBGP, FRR, ExaBGP)</li>
              <li>All NetKnight host containers</li>
              <li>Network configuration</li>
              <li>Container relationships and connections</li>
              <li>IP addresses and port mappings</li>
            </ul>

            <h3>Use Cases</h3>
            <ul>
              <li><strong>Lab Scenarios:</strong> Create setups for different test scenarios</li>
              <li><strong>Quick Reset:</strong> Easily return to a known-good configuration</li>
              <li><strong>Sharing:</strong> Export topologies to share with team</li>
              <li><strong>Testing:</strong> Compare behavior across different topologies</li>
            </ul>

            <h3>Topology Visualizer</h3>
            <p>
              View your topology graphically:
            </p>
            <ul>
              <li>See all daemons and hosts</li>
              <li>View BGP neighbor relationships</li>
              <li>Identify network connections</li>
              <li>Hover for detailed information</li>
            </ul>
          </div>
        );

      case "shortcuts":
        return (
          <div className={styles.sectionContent}>
            <h2>
              <span className={styles.emoji}>⌨️</span> Keyboard Shortcuts & Tips
            </h2>

            <h3>Global Shortcuts</h3>
            <ul>
              <li><kbd>?</kbd> - Open this help dialog</li>
              <li><kbd>Esc</kbd> - Close dialogs and modals</li>
            </ul>

            <h3>Quick Navigation</h3>
            <p>
              Use the navbar to quickly access main sections:
            </p>
            <ul>
              <li><strong>/bgp</strong> - Dashboard & Lab Manager</li>
              <li><strong>/connections</strong> - BGP Neighbors</li>
              <li><strong>/environment</strong> - API Client Management</li>
              <li><strong>/bgp/routes</strong> - Routes & FlowSpec</li>
              <li><strong>/bmp</strong> - BMP Monitoring</li>
              <li><strong>/netflow</strong> - NetFlow Analysis</li>
              <li><strong>/testing</strong> - Network Testing (NetKnight)</li>
              <li><strong>/topologies</strong> - Topology Manager</li>
            </ul>

            <h3>UI Tips</h3>
            <ul>
              <li><strong>Sorting:</strong> Click table column headers to sort</li>
              <li><strong>Filtering:</strong> Use search boxes to quickly find items</li>
              <li><strong>API History:</strong> Click footer to view all API calls</li>
              <li><strong>Telemetry:</strong> View application metrics in footer</li>
              <li><strong>Dark Mode:</strong> Toggle in settings (if available)</li>
            </ul>

            <h3>Workflow Tips</h3>
            <ul>
              <li><strong>Start Simple:</strong> Create 2-3 daemons before complex topologies</li>
              <li><strong>Save Topologies:</strong> Save working configurations before experiments</li>
              <li><strong>Monitor First:</strong> Enable BMP/NetFlow before testing</li>
              <li><strong>Use NetKnight:</strong> Validate routing with actual traffic</li>
              <li><strong>Check APIs:</strong> Use API history to debug issues</li>
            </ul>

            <h3>Getting Help</h3>
            <ul>
              <li>Press <kbd>?</kbd> for this help dialog</li>
              <li>Check API call history for errors</li>
              <li>Review container logs: <code>docker logs &lt;container&gt;</code></li>
              <li>Test APIs manually: <code>curl http://localhost:5010/</code></li>
            </ul>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>NetStream Help</h2>
          <button onClick={onClose} className={styles.closeButton}>
            ×
          </button>
        </div>

        <div className={styles.container}>
          <div className={styles.sidebar}>
            <nav>
              {sections.map((section) => (
                <button
                  key={section.id}
                  className={`${styles.navItem} ${
                    activeSection === section.id ? styles.active : ""
                  }`}
                  onClick={() => setActiveSection(section.id)}
                >
                  <span className={styles.emoji}>{section.emoji}</span>
                  <span>{section.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className={styles.content}>{renderContent()}</div>
        </div>

        <div className={styles.footer}>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
