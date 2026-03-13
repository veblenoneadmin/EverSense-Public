import type { Widget, WidgetService } from './WidgetInterface';

class WidgetServiceImpl implements WidgetService {
  private widgets: Map<string, Widget> = new Map();

  getAllWidgets(): Widget[] {
    return Array.from(this.widgets.values());
  }

  getWidget(id: string): Widget | null {
    return this.widgets.get(id) || null;
  }

  registerWidget(widget: Widget): void {
    const id = widget.id.trim();
    if (!id) {
      throw new Error('Widget needs a non-empty ID');
    }
    
    if (this.widgets.has(id)) {
      console.warn(`Widget with ID "${id}" is already registered. Overwriting.`);
    }
    
    this.widgets.set(id, widget);
  }

  hasWidget(id: string): boolean {
    return this.widgets.has(id);
  }

  getWidgetsByCategory(category: string): Widget[] {
    return Array.from(this.widgets.values()).filter(
      widget => widget.category === category
    );
  }

  // Utility methods
  getWidgetCategories(): string[] {
    const categories = new Set<string>();
    this.widgets.forEach(widget => {
      categories.add(widget.category);
    });
    return Array.from(categories).sort();
  }

  getConfigurableWidgets(): Widget[] {
    return Array.from(this.widgets.values()).filter(
      widget => widget.isConfigurable
    );
  }

  validateWidgetConfig(widgetId: string, config: any): boolean {
    const widget = this.getWidget(widgetId);
    if (!widget) return false;
    
    // Basic validation - can be extended
    return typeof config === 'object' && config !== null;
  }
}

// Global widget service instance
export const widgetService = new WidgetServiceImpl();

// Hook for React components
export function useWidgetService() {
  return {
    widgetService,
    getAllWidgets: () => widgetService.getAllWidgets(),
    getWidget: (id: string) => widgetService.getWidget(id),
    getWidgetsByCategory: (category: string) => widgetService.getWidgetsByCategory(category),
    getWidgetCategories: () => widgetService.getWidgetCategories()
  };
}