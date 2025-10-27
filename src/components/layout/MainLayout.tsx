import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Separator } from "@/components/ui/separator";
import { Shield } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface MainLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean; // Allow disabling sidebar for special pages
}

export const MainLayout = ({ children, showSidebar = true }: MainLayoutProps) => {
  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="min-h-screen bg-muted/30">
          {/* Persistent Header with Sidebar Toggle */}
          <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 border-b bg-card/95 backdrop-blur-md px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2 flex-1">
              <Shield className="h-4 w-4 text-info" />
              <span className="text-sm font-medium text-muted-foreground">
                Internal Team Access Only
              </span>
            </div>
            {/* Theme Toggle for Admin Dashboard */}
            <ThemeToggle />
          </header>

          {/* Page Content */}
          <div className="w-full">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};
