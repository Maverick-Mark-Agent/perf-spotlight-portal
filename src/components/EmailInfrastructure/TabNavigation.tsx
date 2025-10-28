/**
 * Tab Navigation Component
 *
 * Main tab navigation for the Email Infrastructure Dashboard
 * Tabs: Overview / Performance / Home Insurance / All Clients
 * Created: 2025-10-27
 */

import { LayoutDashboard, TrendingUp, Home, Users } from 'lucide-react';

export type TabValue = 'overview' | 'performance' | 'home-insurance' | 'all-clients';

interface Tab {
  value: TabValue;
  label: string;
  icon: React.ElementType;
  description: string;
}

interface TabNavigationProps {
  activeTab: TabValue;
  onTabChange: (tab: TabValue) => void;
}

const tabs: Tab[] = [
  {
    value: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    description: 'Dashboard overview with health metrics',
  },
  {
    value: 'performance',
    label: 'Performance',
    icon: TrendingUp,
    description: 'Email provider performance analytics',
  },
  {
    value: 'home-insurance',
    label: 'Home Insurance',
    icon: Home,
    description: 'Dedicated view for home insurance campaigns',
  },
  {
    value: 'all-clients',
    label: 'All Clients',
    icon: Users,
    description: 'All email accounts across all clients',
  },
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="bg-white/5 rounded-lg border border-white/10 p-2">
      <div className="flex gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;

          return (
            <button
              key={tab.value}
              onClick={() => onTabChange(tab.value)}
              className={`
                flex items-center gap-3 px-6 py-3 rounded-md transition-all flex-1
                ${isActive
                  ? 'bg-dashboard-primary text-white shadow-lg'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
                }
              `}
              title={tab.description}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-white' : 'text-white/60'}`} />
              <div className="flex flex-col items-start">
                <span className={`font-semibold text-sm ${isActive ? 'text-white' : 'text-white/80'}`}>
                  {tab.label}
                </span>
                <span className="text-xs text-white/50 hidden lg:block">
                  {tab.description}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
