import React, { ReactNode } from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => {
  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl text-destructive">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            We encountered an unexpected error. This has been logged and our team will investigate.
          </p>

          {process.env.NODE_ENV === 'development' && (
            <details className="text-left bg-muted p-4 rounded-lg">
              <summary className="cursor-pointer font-medium mb-2">Error Details (Development)</summary>
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap">
                {error.toString()}
                {error.stack}
              </pre>
            </details>
          )}

          <div className="flex gap-4 justify-center">
            <Button onClick={resetErrorBoundary} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button onClick={() => window.location.reload()} variant="default">
              Reload Page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const logError = (error: Error, errorInfo: { componentStack: string }) => {
  console.error('ErrorBoundary caught an error:', error, errorInfo);
};

const ErrorBoundary: React.FC<Props> = ({ children, fallback }) => {
  return (
    <ReactErrorBoundary
      FallbackComponent={fallback ? () => <>{fallback}</> : ErrorFallback}
      onError={logError}
    >
      {children}
    </ReactErrorBoundary>
  );
};

export default ErrorBoundary;
