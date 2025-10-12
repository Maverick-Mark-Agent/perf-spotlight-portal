import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  MapPin,
  Server,
  Home,
  ChevronRight,
  Upload,
  Settings,
  PieChart,
  CreditCard,
  Activity,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

// Navigation items organized by category
const navigationItems = {
  main: [
    {
      title: "Home",
      icon: Home,
      url: "/",
    },
  ],
  analytics: [
    {
      title: "KPI Dashboard",
      icon: BarChart3,
      url: "/kpi-dashboard",
    },
    {
      title: "Volume Dashboard",
      icon: TrendingUp,
      url: "/volume-dashboard",
    },
    {
      title: "Revenue & Billing",
      icon: DollarSign,
      url: "/revenue-dashboard",
    },
    {
      title: "ROI Dashboard",
      icon: PieChart,
      url: "/roi-dashboard",
    },
  ],
  management: [
    {
      title: "Client Management",
      icon: Settings,
      url: "/client-management",
    },
    {
      title: "Contact Pipeline",
      icon: Upload,
      url: "/contact-pipeline",
    },
    {
      title: "Client Portal",
      icon: Users,
      url: "/client-portal",
    },
    {
      title: "ZIP Dashboard",
      icon: MapPin,
      url: "/zip-dashboard",
    },
  ],
  finance: [],
  infrastructure: [
    {
      title: "Email Accounts",
      icon: Server,
      url: "/email-accounts",
    },
    {
      title: "Rollout Progress",
      icon: Activity,
      url: "/rollout-progress",
    },
  ],
};

export function AppSidebar() {
  const location = useLocation();

  // Check if current route is active
  const isActive = (url: string) => {
    if (url === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(url);
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      {/* Header */}
      <SidebarHeader className="border-b border-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <BarChart3 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">Maverick Marketing</span>
            <span className="text-xs text-muted-foreground">Analytics Portal</span>
          </div>
        </div>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent>
        {/* Main */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.main.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Analytics */}
        <SidebarGroup>
          <SidebarGroupLabel>Analytics</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.analytics.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Management */}
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.management.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Finance */}
        <SidebarGroup>
          <SidebarGroupLabel>Finance</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.finance.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Infrastructure */}
        <SidebarGroup>
          <SidebarGroupLabel>Infrastructure</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.infrastructure.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-border">
        <div className="flex items-center gap-2 px-2 py-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-2 w-2 items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          </div>
          <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            Live Data
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
