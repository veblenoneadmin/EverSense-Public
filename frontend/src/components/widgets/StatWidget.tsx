import { BaseWidget } from './BaseWidget';
import type { WidgetProps } from '../../lib/widgets/WidgetInterface';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatWidgetData {
  value: number | string;
  label: string;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
    label: string;
  };
  format?: 'number' | 'currency' | 'percentage' | 'duration';
  prefix?: string;
  suffix?: string;
}

interface StatWidgetProps extends WidgetProps {
  data?: StatWidgetData;
}

export function StatWidget(props: StatWidgetProps) {
  const { data } = props;

  const formatValue = (value: number | string): string => {
    if (!data) return '0';
    
    if (typeof value === 'string') return value;
    
    switch (data.format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(value);
      case 'percentage':
        return `${value}%`;
      case 'duration':
        // Convert seconds to hours:minutes
        const hours = Math.floor(value / 3600);
        const minutes = Math.floor((value % 3600) / 60);
        return `${hours}h ${minutes}m`;
      case 'number':
      default:
        return new Intl.NumberFormat().format(value);
    }
  };

  const getTrendIcon = () => {
    if (!data?.trend) return null;
    
    switch (data.trend.direction) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'neutral':
      default:
        return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendColor = () => {
    if (!data?.trend) return 'text-muted-foreground';
    
    switch (data.trend.direction) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      case 'neutral':
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <BaseWidget {...props}>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="flex items-center space-x-1">
              {data?.prefix && (
                <span className="text-sm text-muted-foreground">{data.prefix}</span>
              )}
              <div className="text-2xl font-bold tracking-tight">
                {data ? formatValue(data.value) : '0'}
              </div>
              {data?.suffix && (
                <span className="text-sm text-muted-foreground">{data.suffix}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.label || 'Statistic'}
            </p>
          </div>
          
          {data?.trend && (
            <div className={`flex items-center space-x-1 text-xs ${getTrendColor()}`}>
              {getTrendIcon()}
              <span>
                {Math.abs(data.trend.value)}
                {data.format === 'percentage' ? 'pp' : '%'}
              </span>
            </div>
          )}
        </div>
        
        {data?.trend && (
          <p className="text-xs text-muted-foreground">
            {data.trend.label}
          </p>
        )}
      </div>
    </BaseWidget>
  );
}