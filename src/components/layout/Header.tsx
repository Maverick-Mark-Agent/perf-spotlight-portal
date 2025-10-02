import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  backTo?: string;
  backLabel?: string;
  children?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBackButton = true,
  backTo = '/',
  backLabel = 'Back to Portal',
  children
}) => {
  return (
    <div className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border shadow-md">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {showBackButton && (
              <>
                <Button asChild variant="ghost" size="sm" className="hover:bg-accent">
                  <Link to={backTo}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {backLabel}
                  </Link>
                </Button>
                <div className="h-6 w-px bg-border"></div>
              </>
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {title}
              </h1>
              {subtitle && (
                <p className="text-muted-foreground text-sm">{subtitle}</p>
              )}
            </div>
          </div>
          {children && (
            <div className="flex items-center gap-4">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
