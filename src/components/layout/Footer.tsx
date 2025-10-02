import React from 'react';

interface FooterProps {
  className?: string;
}

export const Footer: React.FC<FooterProps> = ({ className }) => {
  return (
    <footer className={`bg-card border-t border-border py-6 ${className || ''}`}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            © 2024 Performance Portal. All rights reserved.
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Version 1.0.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
