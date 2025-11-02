import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  Home, 
  BarChart3, 
  Mail, 
  TrendingUp, 
  CreditCard,
  Settings
} from 'lucide-react';
import { ROUTES } from '@/constants/navigation';

interface SidebarProps {
  className?: string;
}

const navigation = [
  { name: 'Home', href: ROUTES.HOME, icon: Home },
  { name: 'KPI Dashboard', href: ROUTES.KPI_DASHBOARD, icon: BarChart3 },
  { name: 'Email Accounts', href: ROUTES.EMAIL_ACCOUNTS, icon: Mail },
  { name: 'Volume Dashboard', href: ROUTES.VOLUME_DASHBOARD, icon: TrendingUp },
  { name: 'Billing', href: ROUTES.BILLING, icon: CreditCard },
];

export const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const location = useLocation();

  return (
    <div className={cn("w-64 bg-card border-r border-border", className)}>
      <div className="p-6">
        <h2 className="text-lg font-semibold text-foreground">Performance Portal</h2>
      </div>
      <nav className="px-4 pb-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};
