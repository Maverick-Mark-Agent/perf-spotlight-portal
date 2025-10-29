/**
 * Health Score Hook
 *
 * Calculates overall email infrastructure health score (0-100)
 * Based on: connection rate, reply rate, bounce rate, failed accounts, stale data
 * Created: 2025-10-27
 */

import { useMemo } from 'react';

export interface HealthScoreMetrics {
  totalAccounts: number;
  connectedAccounts: number;
  disconnectedAccounts: number;
  failedAccounts: number;
  totalSent: number;
  totalReplies: number;
  totalBounces: number;
  dataAgeHours: number;
}

export interface HealthScoreBreakdown {
  overall: number;
  connectionHealth: number;
  performanceHealth: number;
  dataFreshnessHealth: number;
  reliabilityHealth: number;
}

export interface HealthScoreResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  color: string;
  breakdown: HealthScoreBreakdown;
  issues: string[];
  recommendations: string[];
}

export function useHealthScore(metrics: HealthScoreMetrics | null): HealthScoreResult {
  return useMemo(() => {
    if (!metrics || metrics.totalAccounts === 0) {
      return {
        score: 0,
        grade: 'F',
        status: 'critical',
        color: 'text-red-500',
        breakdown: {
          overall: 0,
          connectionHealth: 0,
          performanceHealth: 0,
          dataFreshnessHealth: 0,
          reliabilityHealth: 0,
        },
        issues: ['No data available'],
        recommendations: ['Sync email accounts data'],
      };
    }

    const issues: string[] = [];
    const recommendations: string[] = [];

    // 1. CONNECTION HEALTH (35% weight)
    const connectionRate = metrics.connectedAccounts / metrics.totalAccounts;
    let connectionHealth = connectionRate * 100;

    if (connectionRate < 0.95) {
      issues.push(`${metrics.disconnectedAccounts} accounts disconnected`);
      recommendations.push('Reconnect disconnected accounts immediately');
    }
    if (connectionRate < 0.90) {
      issues.push('Critical connection rate below 90%');
    }

    // 2. PERFORMANCE HEALTH (30% weight)
    const replyRate = metrics.totalSent > 0 ? metrics.totalReplies / metrics.totalSent : 0;
    const bounceRate = metrics.totalSent > 0 ? metrics.totalBounces / metrics.totalSent : 0;

    // Reply rate scoring (good is 5-15%, excellent is >15%)
    let replyScore = 0;
    if (replyRate >= 0.15) replyScore = 100;
    else if (replyRate >= 0.10) replyScore = 85;
    else if (replyRate >= 0.05) replyScore = 70;
    else if (replyRate >= 0.03) replyScore = 50;
    else replyScore = 30;

    // Bounce rate scoring (good is <2%, excellent is <1%)
    let bounceScore = 0;
    if (bounceRate <= 0.01) bounceScore = 100;
    else if (bounceRate <= 0.02) bounceScore = 85;
    else if (bounceRate <= 0.03) bounceScore = 70;
    else if (bounceRate <= 0.05) bounceScore = 50;
    else bounceScore = 30;

    const performanceHealth = (replyScore + bounceScore) / 2;

    if (replyRate < 0.05) {
      issues.push(`Low reply rate: ${(replyRate * 100).toFixed(1)}%`);
      recommendations.push('Review email copy and targeting');
    }
    if (bounceRate > 0.03) {
      issues.push(`High bounce rate: ${(bounceRate * 100).toFixed(1)}%`);
      recommendations.push('Clean email lists and verify account health');
    }

    // 3. DATA FRESHNESS HEALTH (15% weight)
    let dataFreshnessHealth = 100;
    if (metrics.dataAgeHours > 24) {
      dataFreshnessHealth = 30;
      issues.push(`Data is ${metrics.dataAgeHours.toFixed(1)} hours old`);
      recommendations.push('Trigger manual sync to refresh data');
    } else if (metrics.dataAgeHours > 12) {
      dataFreshnessHealth = 60;
      issues.push('Data may be slightly stale');
    } else if (metrics.dataAgeHours > 6) {
      dataFreshnessHealth = 80;
    }

    // 4. RELIABILITY HEALTH (20% weight)
    const failedRate = metrics.failedAccounts / metrics.totalAccounts;
    let reliabilityHealth = (1 - failedRate) * 100;

    if (failedRate > 0.05) {
      issues.push(`${metrics.failedAccounts} accounts in failed state`);
      recommendations.push('Investigate and fix failed accounts');
    }
    if (failedRate > 0.10) {
      issues.push('Critical: >10% of accounts failing');
    }

    // CALCULATE OVERALL SCORE (weighted average)
    const overall = (
      connectionHealth * 0.35 +
      performanceHealth * 0.30 +
      dataFreshnessHealth * 0.15 +
      reliabilityHealth * 0.20
    );

    // Determine grade and status
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    let status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
    let color: string;

    if (overall >= 90) {
      grade = 'A';
      status = 'excellent';
      color = 'text-green-500';
    } else if (overall >= 80) {
      grade = 'B';
      status = 'good';
      color = 'text-green-400';
    } else if (overall >= 70) {
      grade = 'C';
      status = 'fair';
      color = 'text-yellow-500';
    } else if (overall >= 60) {
      grade = 'D';
      status = 'poor';
      color = 'text-orange-500';
    } else {
      grade = 'F';
      status = 'critical';
      color = 'text-red-500';
    }

    // Add positive feedback if no issues
    if (issues.length === 0) {
      recommendations.push('Maintain current practices');
      recommendations.push('Monitor metrics daily');
    }

    return {
      score: Math.round(overall),
      grade,
      status,
      color,
      breakdown: {
        overall: Math.round(overall),
        connectionHealth: Math.round(connectionHealth),
        performanceHealth: Math.round(performanceHealth),
        dataFreshnessHealth: Math.round(dataFreshnessHealth),
        reliabilityHealth: Math.round(reliabilityHealth),
      },
      issues,
      recommendations,
    };
  }, [metrics]);
}
