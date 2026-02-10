// Dashboard-related type definitions

export interface ClientData {
  name: string;
  emails: number;
  target: number;
  projection: number;
  targetPercentage: number;
  projectedPercentage: number;
  isAboveTarget: boolean;
  isProjectedAboveTarget: boolean;
  variance: number;
  projectedVariance: number;
  distanceToTarget: number;
  rank: number;
}

export interface ClientSchedule {
  clientName: string;
  todayEmails: number;
  tomorrowEmails: number;
  totalScheduled: number;
  threeDayAverage: number;
}

export interface KPIData {
  id: string;
  name: string;
  current: number;
  target: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  period: string;
}

export interface PerformanceMetric {
  label: string;
  value: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
}
