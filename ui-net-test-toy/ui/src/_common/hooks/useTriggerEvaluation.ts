/**
 * Client-side Trigger Evaluation Hook
 * Evaluates triggers against aggregated NetFlow data (same as Top Talkers pane)
 * This provides real-time trigger notifications without requiring backend connectivity
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useAppSelector } from '../store/hooks';
import { makeSelectTopTalkers } from '../store/netflowSelectors';
import type { NotificationEvent } from './useNotifications';
import type { Trigger } from '../types/netflow';

interface TriggerEvaluationOptions {
  /** Triggers to evaluate */
  triggers: Trigger[];
  /** Callback when a trigger fires */
  onTriggerFired: (notification: NotificationEvent) => void;
  /** Evaluation interval in ms (default: 5000) */
  evaluationInterval?: number;
  /** Cooldown period per trigger in ms (default: 60000) */
  cooldownPeriod?: number;
  /** Enable evaluation (default: true) */
  enabled?: boolean;
}

interface TopTalker {
  address: string;
  bytes: number;
  packets: number;
  flows: number;
  avgBps: number;
}

/**
 * Hook that evaluates triggers against aggregated flow data client-side
 * Uses the same Top Talkers calculation as the UI pane
 */
export function useTriggerEvaluation(options: TriggerEvaluationOptions) {
  const {
    triggers,
    onTriggerFired,
    evaluationInterval = 5000,
    cooldownPeriod = 60000,
    enabled = true
  } = options;

  // Get Top Talkers data (same calculation as TopTalkersPane)
  const selectTopTalkers = useMemo(() => makeSelectTopTalkers(100), []);
  const topTalkers = useAppSelector(selectTopTalkers) as TopTalker[];

  // Track last trigger time per trigger+IP combo for cooldown
  const lastTriggerTimes = useRef<Map<string, number>>(new Map());

  // Calculate rates from top talkers
  // The avgBps is already calculated in the selector
  const getAggregatedStats = useCallback(() => {
    return topTalkers.map(talker => ({
      address: talker.address,
      bytes: talker.bytes,
      packets: talker.packets,
      flows: talker.flows,
      bps: talker.avgBps,
      kbps: talker.avgBps / 1000,
      mbps: talker.avgBps / 1000000,
      pps: talker.flows > 0 ? talker.packets / talker.flows : 0 // Approximate
    }));
  }, [topTalkers]);

  // Evaluate a single trigger against aggregated stats
  const evaluateTrigger = useCallback((
    trigger: Trigger,
    stats: ReturnType<typeof getAggregatedStats>
  ): { matched: boolean; matchedAddress?: string; matchedStats?: typeof stats[0] } => {
    if (!trigger.enabled) {
      return { matched: false };
    }

    const conditions = trigger.conditions;

    // Check each IP's stats against the trigger conditions
    for (const ipStats of stats) {
      let allConditionsMet = true;

      // IP address filters
      if (conditions.src_addr && ipStats.address !== conditions.src_addr) {
        continue;
      }
      if (conditions.dst_addr && ipStats.address !== conditions.dst_addr) {
        continue;
      }
      if (conditions.src_or_dst_addr && ipStats.address !== conditions.src_or_dst_addr) {
        continue;
      }

      // Rate thresholds
      if (conditions.min_kbps !== undefined) {
        if (ipStats.kbps < conditions.min_kbps) {
          allConditionsMet = false;
        }
      }

      if (conditions.min_mbps !== undefined) {
        if (ipStats.mbps < conditions.min_mbps) {
          allConditionsMet = false;
        }
      }

      if (conditions.min_pps !== undefined) {
        if (ipStats.pps < conditions.min_pps) {
          allConditionsMet = false;
        }
      }

      if (conditions.min_bytes !== undefined) {
        if (ipStats.bytes < conditions.min_bytes) {
          allConditionsMet = false;
        }
      }

      // If all conditions met for this IP, trigger matched
      if (allConditionsMet) {
        return { matched: true, matchedAddress: ipStats.address, matchedStats: ipStats };
      }
    }

    return { matched: false };
  }, []);

  // Main evaluation loop
  useEffect(() => {
    if (!enabled || triggers.length === 0) {
      return;
    }

    const evaluate = () => {
      const stats = getAggregatedStats();
      if (stats.length === 0) {
        return;
      }

      const now = Date.now();

      for (const trigger of triggers) {
        const result = evaluateTrigger(trigger, stats);

        if (result.matched && result.matchedAddress && result.matchedStats) {
          // Check cooldown
          const cooldownKey = `${trigger.id || trigger.name}-${result.matchedAddress}`;
          const lastTime = lastTriggerTimes.current.get(cooldownKey) || 0;

          if (now - lastTime < cooldownPeriod) {
            // Still in cooldown, skip
            continue;
          }

          // Update cooldown
          lastTriggerTimes.current.set(cooldownKey, now);

          // Clean up old cooldowns
          for (const [key, time] of lastTriggerTimes.current.entries()) {
            if (now - time > cooldownPeriod * 2) {
              lastTriggerTimes.current.delete(key);
            }
          }

          // Fire the trigger notification
          const notification: NotificationEvent = {
            type: 'trigger_event',
            timestamp: new Date().toISOString(),
            trigger_name: trigger.name,
            action_type: trigger.action.type,
            flow: {
              src: result.matchedAddress,
              dst: result.matchedAddress,
              kbps: result.matchedStats.kbps,
              mbps: result.matchedStats.mbps
            },
            message: trigger.action.message ||
              `Trigger '${trigger.name}' fired: ${result.matchedAddress} at ${result.matchedStats.mbps.toFixed(2)} Mbps`,
            severity: trigger.action.type === 'flowspec' ? 'warning' : 'info'
          };

          console.log('[TriggerEvaluation] Trigger fired:', notification);
          onTriggerFired(notification);
        }
      }
    };

    // Initial evaluation
    evaluate();

    // Setup interval
    const intervalId = setInterval(evaluate, evaluationInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [
    enabled,
    triggers,
    evaluationInterval,
    cooldownPeriod,
    getAggregatedStats,
    evaluateTrigger,
    onTriggerFired
  ]);

  // Return stats for debugging
  return {
    topTalkers,
    aggregatedStats: getAggregatedStats()
  };
}

export default useTriggerEvaluation;
