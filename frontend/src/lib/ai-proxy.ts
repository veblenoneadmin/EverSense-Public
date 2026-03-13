// Secure server-side proxy for AI processing
import { generateId } from './utils';

export class AIProxyService {
  private static baseURL = '/api/ai'; // Server endpoint instead of direct OpenRouter

  static async processBrainDump(content: string): Promise<ProcessedBrainDump> {
    try {
      // Call our secure server endpoint instead of OpenRouter directly
      const response = await fetch(`${this.baseURL}/process-brain-dump`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.trim(),
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`AI processing failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      return result;
    } catch (error) {
      console.error('AI processing error:', error);
      // Fallback to client-side simulation if server is unavailable
      return this.simulateAIProcessing(content);
    }
  }

  // Keep simulation as fallback
  private static simulateAIProcessing(content: string): ProcessedBrainDump {
    const lines = content.split('\n').filter(line => line.trim());
    const tasks: ExtractedTask[] = [];
    
    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine.length < 5) return;
      
      if (this.isTaskLike(trimmedLine)) {
        const priority = this.determinePriority(trimmedLine);
        const estimatedTime = this.estimateTime(trimmedLine);
        const category = this.categorizeTask(trimmedLine);
        
        tasks.push({
          id: generateId(),
          title: this.extractTitle(trimmedLine),
          description: trimmedLine,
          priority,
          estimatedHours: estimatedTime,
          category,
          tags: this.extractTags(trimmedLine),
          microTasks: this.generateMicroTasks(trimmedLine)
        });
      }
    });

    if (tasks.length === 0) {
      tasks.push({
        id: generateId(),
        title: this.extractTitle(content.substring(0, 50)),
        description: content,
        priority: 'medium',
        estimatedHours: 2,
        category: 'general',
        tags: [],
        microTasks: []
      });
    }

    return {
      originalContent: content,
      extractedTasks: tasks,
      summary: this.generateSummary(tasks),
      processingTimestamp: new Date().toISOString(),
      aiModel: 'simulation-fallback'
    };
  }

  private static isTaskLike(text: string): boolean {
    const taskIndicators = [
      'need to', 'have to', 'should', 'must', 'create', 'build', 'implement',
      'fix', 'update', 'review', 'test', 'deploy', 'setup', 'configure',
      'design', 'research', 'analyze', 'write', 'document', 'plan'
    ];
    
    const lowerText = text.toLowerCase();
    return taskIndicators.some(indicator => lowerText.includes(indicator));
  }

  private static determinePriority(text: string): 'low' | 'medium' | 'high' | 'urgent' {
    const urgentWords = ['urgent', 'asap', 'immediately', 'critical', 'emergency'];
    const highWords = ['important', 'priority', 'soon', 'deadline'];
    
    const lowerText = text.toLowerCase();
    
    if (urgentWords.some(word => lowerText.includes(word))) return 'urgent';
    if (highWords.some(word => lowerText.includes(word))) return 'high';
    if (lowerText.includes('low priority') || lowerText.includes('when time')) return 'low';
    
    return 'medium';
  }

  private static estimateTime(text: string): number {
    const timeMatches = text.match(/(\d+)\s*(hour|hr|minute|min)/gi);
    if (timeMatches) {
      const match = timeMatches[0];
      const value = parseInt(match.match(/\d+/)?.[0] || '0');
      const unit = match.toLowerCase();
      
      if (unit.includes('hour') || unit.includes('hr')) {
        return value;
      } else if (unit.includes('minute') || unit.includes('min')) {
        return Math.max(0.25, value / 60);
      }
    }
    
    const complexWords = ['integration', 'system', 'architecture', 'database', 'api'];
    const simpleWords = ['update', 'fix', 'change', 'add'];
    
    const lowerText = text.toLowerCase();
    
    if (complexWords.some(word => lowerText.includes(word))) {
      return Math.random() * 6 + 4;
    } else if (simpleWords.some(word => lowerText.includes(word))) {
      return Math.random() * 2 + 0.5;
    }
    
    return Math.random() * 4 + 1;
  }

  private static categorizeTask(text: string): string {
    const categories = {
      'development': ['code', 'implement', 'build', 'develop', 'programming'],
      'design': ['design', 'ui', 'ux', 'mockup', 'wireframe'],
      'testing': ['test', 'qa', 'debug', 'fix', 'bug'],
      'research': ['research', 'analyze', 'investigate', 'study'],
      'documentation': ['document', 'write', 'readme', 'docs'],
      'meeting': ['meeting', 'call', 'discussion', 'standup'],
      'deployment': ['deploy', 'release', 'publish', 'launch']
    };
    
    const lowerText = text.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return category;
      }
    }
    
    return 'general';
  }

  private static extractTitle(text: string): string {
    const cleaned = text.replace(/[^\w\s]/g, ' ').trim();
    const words = cleaned.split(/\s+/).slice(0, 6);
    return words.join(' ').substring(0, 50);
  }

  private static extractTags(text: string): string[] {
    const tags = [];
    const lowerText = text.toLowerCase();
    
    const techTags = ['react', 'node', 'python', 'api', 'database', 'frontend', 'backend'];
    techTags.forEach(tag => {
      if (lowerText.includes(tag)) tags.push(tag);
    });
    
    if (lowerText.includes('urgent')) tags.push('urgent');
    if (lowerText.includes('client')) tags.push('client');
    
    return tags;
  }

  private static generateMicroTasks(text: string): string[] {
    const microTasks = [];
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('implement') || lowerText.includes('build')) {
      microTasks.push('Plan implementation approach');
      microTasks.push('Set up development environment');
      microTasks.push('Write initial code structure');
      microTasks.push('Test implementation');
    } else if (lowerText.includes('fix') || lowerText.includes('bug')) {
      microTasks.push('Reproduce the issue');
      microTasks.push('Identify root cause');
      microTasks.push('Implement fix');
      microTasks.push('Verify fix works');
    } else if (lowerText.includes('research')) {
      microTasks.push('Define research scope');
      microTasks.push('Gather information');
      microTasks.push('Analyze findings');
      microTasks.push('Document results');
    }
    
    return microTasks;
  }

  private static generateSummary(tasks: ExtractedTask[]): string {
    if (tasks.length === 0) return 'No actionable tasks identified.';
    
    const totalHours = tasks.reduce((sum, task) => sum + task.estimatedHours, 0);
    const categories = [...new Set(tasks.map(task => task.category))];
    const priorities = tasks.map(task => task.priority);
    const urgentCount = priorities.filter(p => p === 'urgent').length;
    const highCount = priorities.filter(p => p === 'high').length;
    
    return `Identified ${tasks.length} actionable tasks across ${categories.length} categories. ` +
           `Estimated total time: ${Math.round(totalHours * 10) / 10} hours. ` +
           `Priority breakdown: ${urgentCount} urgent, ${highCount} high priority tasks.`;
  }
}

// TypeScript interfaces (reuse from original)
export interface ExtractedTask {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedHours: number;
  category: string;
  tags: string[];
  microTasks: string[];
}

export interface ProcessedBrainDump {
  originalContent: string;
  extractedTasks: ExtractedTask[];
  summary: string;
  processingTimestamp: string;
  aiModel: string;
}