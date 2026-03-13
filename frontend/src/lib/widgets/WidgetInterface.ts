export interface WidgetData {
  [key: string]: any;
}

export interface WidgetConfig {
  title?: string;
  refreshInterval?: number; // seconds
  size?: 'small' | 'medium' | 'large' | 'full';
  color?: string;
  icon?: string;
  dataSource?: string;
  filters?: Record<string, any>;
}

export interface Widget {
  id: string;
  name: string;
  description: string;
  category: 'statistics' | 'charts' | 'lists' | 'quick-actions' | 'overview';
  component: React.ComponentType<WidgetProps>;
  defaultConfig: WidgetConfig;
  permissions?: string[];
  isConfigurable: boolean;
}

export interface WidgetProps {
  config: WidgetConfig;
  data?: any; // Allow any data type for flexibility
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onConfigChange?: (newConfig: WidgetConfig) => void;
  orgId: string;
  userId: string;
}

export interface DashboardLayout {
  id: string;
  userId: string;
  orgId?: string;
  name: string;
  isDefault: boolean;
  widgets: DashboardWidget[];
  layout: GridLayout[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardWidget {
  widgetId: string;
  instanceId: string;
  config: WidgetConfig;
  position: WidgetPosition;
}

export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridLayout {
  i: string; // instanceId
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface WidgetService {
  getAllWidgets(): Widget[];
  getWidget(id: string): Widget | null;
  registerWidget(widget: Widget): void;
  hasWidget(id: string): boolean;
  getWidgetsByCategory(category: string): Widget[];
}