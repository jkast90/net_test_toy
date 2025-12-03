// src/pages/About.jsx
import styles from "./About.module.css";

export default function About() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Header */}
        <div className={styles.hero}>
          <h1 className={styles.title}>
            <span className={styles.emoji}>📯</span> Welcome to RouteHerald{" "}
            <span className={styles.emoji}>🛡️</span>
          </h1>
          <p className={styles.subtitle}>
            The Trumpet of Truth in the BGP Kingdom
          </p>
        </div>

        {/* Banner */}
        <div style={{ textAlign: "center", margin: "2rem 0" }}>
          <img
            src="/routeherald-banner.png"
            alt="RouteHerald logo banner"
            style={{ maxWidth: "100%", height: "auto", borderRadius: "8px" }}
          />
        </div>

        {/* Introduction */}
        <section className={styles.section}>
          <p>
            In the vast kingdom of network infrastructure, where packets traverse digital highways and routing decisions shape the internet's flow,
            <strong> RouteHerald</strong> stands as your trusted sentinel. This advanced BGP management platform serves as the unified control plane
            for multiple routing daemons, bringing order to the complex realm of internet routing.
          </p>

          <p>
            Built with modern technologies and battle-tested in production environments, RouteHerald combines the reliability of
            industry-standard routing protocols with intuitive management interfaces. Whether you're managing a small network or
            orchestrating enterprise-scale BGP deployments, RouteHerald provides the tools and visibility you need.
          </p>
        </section>

        {/* Features */}
        <section className={styles.section}>
          <h2>
            <span className={styles.emoji}>✨</span> Core Features
          </h2>
          <div className={styles.featureCard}>
            <ul>
              <li>📡 Real-time BGP peer monitoring and status tracking</li>
              <li>🛡️ Multi-daemon support: GoBGP, FRR, and ExaBGP under one interface</li>
              <li>🔍 Comprehensive route inspection with AS path analysis</li>
              <li>✏️ RESTful APIs with WebSocket support for live updates</li>
              <li>🔐 RPKI validation for enhanced routing security</li>
              <li>🚦 FlowSpec rule management for traffic engineering</li>
              <li>📊 BMP (BGP Monitoring Protocol) for passive route monitoring</li>
              <li>📈 NetFlow v5 collection and analysis capabilities</li>
              <li>🏗️ Visual topology builder and lab environment management</li>
              <li>🧪 Network testing tools for performance validation</li>
            </ul>
          </div>
        </section>

        {/* Use Cases */}
        <section className={styles.section}>
          <h2>
            <span className={styles.emoji}>🎯</span> What You Can Do
          </h2>
          <div className={styles.featureCard}>
            <p>
              From development labs to production networks, <strong>RouteHerald empowers you</strong> to manage complex
              BGP infrastructures with confidence and clarity.
            </p>
            <ul>
              <li><strong>Monitor BGP Health:</strong> Track peer states, session uptime, and route counts in real-time</li>
              <li><strong>Manage Multiple Daemons:</strong> Control GoBGP, FRR, and ExaBGP from a unified interface</li>
              <li><strong>Build Lab Environments:</strong> Create and test network topologies with Docker-based routing daemons</li>
              <li><strong>Validate Route Security:</strong> Implement RPKI validation to prevent route hijacking</li>
              <li><strong>Engineer Traffic Flows:</strong> Deploy FlowSpec rules for granular traffic control</li>
              <li><strong>Analyze Network Behavior:</strong> Collect NetFlow data and monitor BGP events via BMP</li>
              <li><strong>Test Network Performance:</strong> Run iperf tests and validate connectivity scenarios</li>
              <li><strong>Debug Routing Issues:</strong> Inspect route attributes, AS paths, and BGP updates in real-time</li>
            </ul>
          </div>
        </section>

        {/* Technology Stack */}
        <section className={styles.section}>
          <h2>
            <span className={styles.emoji}>⚙️</span> Technology Stack
          </h2>
          <div className={styles.featureCard}>
            <h3>BGP Daemons</h3>
            <ul>
              <li><strong>GoBGP:</strong> Modern BGP implementation in Go with gRPC API</li>
              <li><strong>FRR:</strong> Free Range Routing with comprehensive protocol support</li>
              <li><strong>ExaBGP:</strong> Python-based BGP route injector for testing</li>
            </ul>

            <h3>Security & Validation</h3>
            <ul>
              <li><strong>RPKI:</strong> Routinator integration for route origin validation</li>
              <li><strong>FlowSpec:</strong> BGP FlowSpec for traffic filtering and DDoS mitigation</li>
            </ul>

            <h3>Monitoring & Analysis</h3>
            <ul>
              <li><strong>BMP:</strong> BGP Monitoring Protocol for passive route monitoring</li>
              <li><strong>NetFlow:</strong> NetFlow v5 collection and analysis</li>
            </ul>

            <h3>Application Stack</h3>
            <ul>
              <li><strong>Backend:</strong> FastAPI with Python for high-performance APIs</li>
              <li><strong>Frontend:</strong> React with TypeScript for type-safe UI</li>
              <li><strong>Infrastructure:</strong> Docker Compose for orchestration</li>
              <li><strong>Communication:</strong> gRPC for efficient BGP daemon communication</li>
            </ul>
          </div>
        </section>

        {/* Getting Started */}
        <section className={styles.section}>
          <h2>
            <span className={styles.emoji}>🚀</span> Getting Started
          </h2>
          <div className={styles.featureCard}>
            <ol>
              <li><strong>Set Up Connections:</strong> Navigate to the Connections page to configure your BGP daemons</li>
              <li><strong>View Dashboard:</strong> Check the main dashboard for an overview of your BGP network health</li>
              <li><strong>Explore Routes:</strong> Browse active routes and analyze their attributes in the Routes section</li>
              <li><strong>Deploy Lab Environment:</strong> Use the Environment Manager to spin up test BGP topologies</li>
              <li><strong>Monitor Real-Time:</strong> Enable BMP monitoring to track BGP updates as they happen</li>
              <li><strong>Test Connectivity:</strong> Use the Network Testing tools to validate your configurations</li>
              <li><strong>Build Topologies:</strong> Design custom network layouts with the visual Topology Builder</li>
            </ol>
          </div>
        </section>

        {/* Architecture */}
        <section className={styles.section}>
          <h2>
            <span className={styles.emoji}>🏗️</span> Architecture
          </h2>
          <p>
            RouteHerald is designed with modern cloud-native principles for scalability and reliability:
          </p>
          <ul>
            <li><strong>Unified API Layer:</strong> FastAPI-powered backend provides a single control plane for all BGP operations</li>
            <li><strong>Multi-Daemon Integration:</strong> gRPC connections to GoBGP, FRR vtysh for FRRouting, and REST API for ExaBGP</li>
            <li><strong>Real-Time Communication:</strong> WebSocket support for live updates and event streaming</li>
            <li><strong>Container-Native:</strong> Docker Compose orchestration with isolated networking for each daemon</li>
            <li><strong>State Management:</strong> Redux-powered frontend with efficient caching and real-time synchronization</li>
            <li><strong>Monitoring Pipeline:</strong> BMP collector for passive monitoring, NetFlow v5 collection for traffic analysis</li>
            <li><strong>Security First:</strong> RPKI validation integration, secure API authentication, and role-based access control</li>
            <li><strong>Lab Automation:</strong> Integrated lab manager for spinning up test environments on demand</li>
          </ul>
        </section>

        {/* Closing */}
        <section className={styles.section}>
          <h2>
            <span className={styles.emoji}>🛡️</span> Why RouteHerald?
          </h2>
          <p>
            In today's interconnected world, BGP is the foundation of internet connectivity. RouteHerald transforms
            the complexity of BGP management into an intuitive, powerful experience. Whether you're preventing route leaks,
            optimizing traffic flows, or building the next generation of network infrastructure, RouteHerald is your trusted companion.
          </p>
          <p>
            By unifying multiple routing daemons under a single interface and providing comprehensive monitoring and validation tools,
            RouteHerald empowers network engineers to focus on what matters most: building resilient, secure, and efficient networks.
          </p>
          <div style={{ textAlign: "center", marginTop: "3rem" }}>
            <span style={{ fontSize: "2rem" }}>📯 🛡️ 🌐</span>
            <p style={{ marginTop: "1rem", fontSize: "1.1rem", fontWeight: "600", color: "var(--accent)" }}>
              <strong>RouteHerald - Your Trusted BGP Control Plane</strong>
            </p>
            <p style={{ marginTop: "0.5rem", fontStyle: "italic", color: "var(--text-muted)" }}>
              May your routes converge swiftly and your peers remain established!
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
