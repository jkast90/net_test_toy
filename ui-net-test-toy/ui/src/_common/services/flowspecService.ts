import { fetchWrapper } from '../utils/fetchWrapper';

// FlowSpec Service - Handles FlowSpec rule operations
export interface FlowSpecMatch {
  source?: string;
  destination?: string;
  protocol?: number;
  source_port?: number;
  destination_port?: number;
  port?: number;
  tcp_flags?: string[];
  packet_length?: number;
  fragment?: string;
}

export interface FlowSpecAction {
  action: string;
  rate?: number;
  redirect?: string;
  mark?: number;
}

export interface FlowSpecRule {
  id?: string;
  family?: string;
  match: FlowSpecMatch;
  actions: FlowSpecAction;
  timestamp?: string;
  backend?: string;
}

export interface FlowSpecDeleteRequest {
  family: string;
  match: FlowSpecMatch;
  actions: FlowSpecAction;
}

class FlowSpecService {
  // Query operations
  /**
   * Fetch FlowSpec rules from a client
   */
  async fetchRules(clientUrl: string, backend: string = 'gobgp'): Promise<FlowSpecRule[]> {
    const data = await fetchWrapper<{ rules: FlowSpecRule[] }>(
      `${clientUrl}/flowspec?backend=${backend}`
    );
    return data.rules || [];
  }

  // Mutation operations
  /**
   * Create a new FlowSpec rule
   */
  async createRule(clientUrl: string, rule: FlowSpecRule, backend: string = 'gobgp'): Promise<void> {
    await fetchWrapper(`${clientUrl}/flowspec?backend=${backend}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
  }

  /**
   * Delete a FlowSpec rule
   */
  async deleteRule(clientUrl: string, rule: FlowSpecDeleteRequest, backend: string = 'gobgp'): Promise<void> {
    await fetchWrapper(`${clientUrl}/flowspec?backend=${backend}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
  }

  // Find a matching rule for a specific flow
  findMatchingRule(
    rules: FlowSpecRule[],
    flow: {
      src_addr: string;
      dst_addr: string;
      src_port?: number;
      dst_port?: number;
      protocol?: number;
    }
  ): FlowSpecRule | undefined {
    return rules.find((rule) => {
      const match = rule.match || {};

      const destMatch = match.destination === `${flow.dst_addr}/32`;
      const srcMatch = match.source === `${flow.src_addr}/32`;
      const protoMatch = !match.protocol || match.protocol === flow.protocol;
      const portMatch = !match.destination_port || match.destination_port === flow.dst_port;

      return destMatch && srcMatch && protoMatch && portMatch;
    });
  }

  // Cancel FlowSpec mitigation for a specific event
  async cancelMitigation(
    clientUrl: string,
    flow: {
      src_addr: string;
      dst_addr: string;
      src_port?: number;
      dst_port?: number;
      protocol?: number;
    },
    backend: string = 'gobgp'
  ): Promise<void> {
    // First, fetch existing rules
    const rules = await this.fetchRules(clientUrl, backend);

    // Find the matching rule
    const matchingRule = this.findMatchingRule(rules, flow);

    if (!matchingRule) {
      throw new Error('No matching FlowSpec rule found for this flow');
    }

    // Delete the matching rule
    await this.deleteRule(
      clientUrl,
      {
        family: matchingRule.family || 'ipv4',
        match: matchingRule.match,
        actions: matchingRule.actions
      },
      backend
    );
  }

  // Build a FlowSpec rule from flow data
  buildRuleFromFlow(
    flow: {
      src_addr: string;
      dst_addr: string;
      src_port?: number;
      dst_port?: number;
      protocol?: number;
    },
    action: FlowSpecAction
  ): FlowSpecRule {
    return {
      family: 'ipv4',
      match: {
        source: `${flow.src_addr}/32`,
        destination: `${flow.dst_addr}/32`,
        protocol: flow.protocol,
        destination_port: flow.dst_port,
        source_port: flow.src_port
      },
      actions: action
    };
  }
}

export const flowspecService = new FlowSpecService();