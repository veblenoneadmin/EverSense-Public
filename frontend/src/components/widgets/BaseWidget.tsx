import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { MoreHorizontal, RefreshCw, Settings, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import type { WidgetProps } from '../../lib/widgets/WidgetInterface';

interface BaseWidgetProps extends WidgetProps {
  children: React.ReactNode;
  onRemove?: () => void;
  onConfigure?: () => void;
  className?: string;
}

export function BaseWidget({
  config,
  loading = false,
  error = null,
  onRefresh,
  onRemove,
  onConfigure,
  children,
  className = ''
}: BaseWidgetProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  const getWidgetIcon = () => {
    if (config.icon) {
      // You can extend this to support more icons
      const iconMap: Record<string, React.ReactNode> = {
        'refresh': <RefreshCw className="h-4 w-4" />,
        'settings': <Settings className="h-4 w-4" />,
      };
      return iconMap[config.icon] || null;
    }
    return null;
  };

  const getSizeClass = () => {
    switch (config.size) {
      case 'small': return 'col-span-1';
      case 'medium': return 'col-span-2';
      case 'large': return 'col-span-3';
      case 'full': return 'col-span-full';
      default: return 'col-span-1';
    }
  };

  return (
    <Card className={`${getSizeClass()} ${className} ${loading ? 'opacity-75' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-2">
          {getWidgetIcon()}
          <div>
            <CardTitle className="text-sm font-medium">
              {config.title || 'Widget'}
            </CardTitle>
            {config.title && (
              <CardDescription className="text-xs">
                Last updated: {new Date().toLocaleTimeString()}
              </CardDescription>
            )}
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onRefresh && (
              <DropdownMenuItem onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </DropdownMenuItem>
            )}
            {onConfigure && (
              <DropdownMenuItem onClick={onConfigure}>
                <Settings className="mr-2 h-4 w-4" />
                Configure
              </DropdownMenuItem>
            )}
            {(onRefresh || onConfigure) && onRemove && <DropdownMenuSeparator />}
            {onRemove && (
              <DropdownMenuItem onClick={onRemove} className="text-red-600">
                <X className="mr-2 h-4 w-4" />
                Remove
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      
      <CardContent>
        {error ? (
          <div className="flex items-center justify-center h-32 text-red-500">
            <div className="text-center">
              <p className="text-sm font-medium">Error loading widget</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
              {onRefresh && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  className="mt-2"
                >
                  <RefreshCw className="mr-2 h-3 w-3" />
                  Retry
                </Button>
              )}
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-2">Loading...</p>
            </div>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}