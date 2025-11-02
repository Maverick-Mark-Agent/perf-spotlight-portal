/**
 * Navigation Constants
 * 
 * Navigation menu items and route definitions for the application.
 * 
 * @file src/constants/navigation.ts
 */

import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  MapPin,
  Server,
  Home,
  Upload,
  Settings,
  PieChart,
  CreditCard,
  Activity,
  UserCog,
  type LucideIcon,
} from "lucide-react";

// ============= Navigation Item Type =============

export interface NavigationItem {
  title: string;
  icon: LucideIcon;
  url: string;
  description?: string;
}

// ============= Main Navigation Items =============

/**
 * Navigation items organized by category
 * Used in AppSidebar component
 */
export const NAVIGATION_ITEMS = {
  main: [
    {
      title: "Home",
      icon: Home,
      url: "/admin",
      description: "Dashboard home and overview",
    },
  ],
  
  analytics: [
    {
      title: "KPI's & Volume",
      icon: BarChart3,
      url: "/kpi-dashboard",
      description: "Key performance indicators and volume metrics",
    },
  ],
  
  management: [
    {
      title: "Client Portal",
      icon: Users,
      url: "/client-portal",
      description: "Client management and portal access",
    },
    {
      title: "Contact Pipeline",
      icon: Upload,
      url: "/contact-pipeline",
      description: "Contact data pipeline and imports",
    },
    {
      title: "ZIP Dashboard",
      icon: MapPin,
      url: "/zip-dashboard",
      description: "Geographic ZIP code analytics",
    },
    {
      title: "Client Management",
      icon: Settings,
      url: "/client-management",
      description: "Manage client settings and configuration",
    },
    {
      title: "User Management",
      icon: UserCog,
      url: "/user-management",
      description: "User accounts and permissions",
    },
  ],
  
  finance: [
    {
      title: "Revenue & Billing",
      icon: DollarSign,
      url: "/revenue-dashboard",
      description: "Revenue tracking and billing",
    },
  ],
  
  infrastructure: [
    {
      title: "Email Accounts",
      icon: Server,
      url: "/email-accounts",
      description: "Email infrastructure and account management",
    },
    {
      title: "Rollout Progress",
      icon: Activity,
      url: "/rollout-progress",
      description: "System rollout and deployment tracking",
    },
  ],
} as const;

// ============= Route Paths =============

/**
 * Application route paths
 * Centralized for easy reference and type safety
 */
export const ROUTES = {
  // Public routes
  HOME: "/",
  MARKETING_HOME: "/home",
  LOGIN: "/login",
  
  // Admin routes
  ADMIN: "/admin",
  
  // Dashboard routes
  KPI_DASHBOARD: "/kpi-dashboard",
  VOLUME_DASHBOARD: "/volume-dashboard",
  REVENUE_DASHBOARD: "/revenue-dashboard",
  ROI_DASHBOARD: "/roi-dashboard",
  KPI_TEST: "/kpi-test",
  
  // Management routes
  CLIENT_PORTAL: "/client-portal",
  CLIENT_MANAGEMENT: "/client-management",
  CLIENT_PROFILE: "/client-profile/:workspaceName",
  USER_MANAGEMENT: "/user-management",
  CONTACT_PIPELINE: "/contact-pipeline",
  ZIP_DASHBOARD: "/zip-dashboard",
  
  // Infrastructure routes
  EMAIL_ACCOUNTS: "/email-accounts",
  ROLLOUT_PROGRESS: "/rollout-progress",
  BILLING: "/billing",
  
  // Utility routes
  NOT_FOUND: "/404",
} as const;

// ============= Navigation Helpers =============

/**
 * Get client profile route with workspace name
 */
export const getClientProfileRoute = (workspaceName: string): string => {
  return `/client-profile/${encodeURIComponent(workspaceName)}`;
};

/**
 * Check if a route is active based on current pathname
 */
export const isRouteActive = (currentPath: string, routePath: string): boolean => {
  if (routePath === "/") {
    return currentPath === "/";
  }
  return currentPath.startsWith(routePath);
};
