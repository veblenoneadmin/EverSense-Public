import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from '../lib/auth-client';
import { useApiClient } from '../lib/api-client';
import { useOrganization } from '../contexts/OrganizationContext';
import {
  X,
  Save,
  FileText,
  Building2,
  Target,
  Users,
  Upload,
  Image as ImageIcon,
  Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  color: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  projectId?: string;
}

interface ProjectReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (report: any) => void;
}

export function ProjectReportModal({ isOpen, onClose, onSave }: ProjectReportModalProps) {
  const { data: session } = useSession();
  const { currentOrg } = useOrganization();
  const apiClient = useApiClient();

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedTask, setSelectedTask] = useState('');
  const [userName, setUserName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedProject('');
      setSelectedTask('');
      setUserName('');
      setReportDescription('');
      setUploadedImage(null);
      setImagePreview(null);
      fetchProjectsAndTasks();
    }
  }, [isOpen]);

  const fetchProjectsAndTasks = async () => {
    if (!session?.user?.id) return;

    setLoading(true);
    try {
      const orgId = currentOrg?.id || 'org_1757046595553';

      // Fetch projects
      const projectsResponse = await apiClient.fetch(`/api/projects?userId=${session.user.id}&orgId=${orgId}&limit=100`);
      if (projectsResponse.success) {
        setProjects(projectsResponse.projects || []);
      }

      // Fetch tasks
      const tasksResponse = await apiClient.fetch(`/api/tasks?orgId=${orgId}&limit=100`);
      if (tasksResponse.success) {
        setTasks(tasksResponse.tasks || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks based on selected project
  const filteredTasks = tasks.filter(task =>
    selectedProject ? task.projectId === selectedProject : true
  );

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
      }

      setUploadedImage(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userName.trim()) {
      alert('Please enter your name');
      return;
    }

    if (!selectedProject) {
      alert('Please select a project');
      return;
    }

    if (!reportDescription.trim()) {
      alert('Please enter a report description');
      return;
    }

    setSubmitting(true);

    try {
      const selectedProjectData = projects.find(p => p.id === selectedProject);
      const selectedTaskData = selectedTask ? tasks.find(t => t.id === selectedTask) : null;

      // Convert image to base64 for storage
      let imageData = null;
      if (uploadedImage) {
        const reader = new FileReader();
        imageData = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(uploadedImage);
        });
      }

      const reportData = {
        id: Date.now().toString(),
        userName: userName.trim(),
        project: selectedProjectData,
        task: selectedTaskData,
        description: reportDescription.trim(),
        image: imageData,
        imageName: uploadedImage?.name,
        createdAt: new Date().toISOString(),
        createdBy: session?.user?.id
      };

      console.log('Creating report:', reportData);
      onSave(reportData);
      onClose();
    } catch (error) {
      console.error('Error creating report:', error);
      alert('Failed to create report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-overlay glass"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal-content glass shadow-elevation"
        style={{
          maxWidth: '800px',
          width: '95%',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
          backgroundColor: '#1a1a1a',
          borderRadius: '12px',
          border: '1px solid #333'
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{
          background: 'linear-gradient(135deg, #646cff, #8b5cf6)',
          borderRadius: '8px 8px 0 0',
          padding: '24px',
          color: 'white'
        }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold m-0">Create Project Report</h2>
              <p className="text-white/80 text-sm m-0 mt-1">
                Generate a comprehensive report for project tracking
              </p>
            </div>
          </div>
          <button
            className="modal-close bg-white/20 hover:bg-white/30 rounded-lg p-2"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form" style={{ padding: '24px' }}>
          <div className="space-y-6">
            {/* User Name */}
            <div className="form-group">
              <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                <Users className="w-4 h-4" />
                Your Name *
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                required
                placeholder="Enter your full name"
                className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* Project Selection */}
            <div className="form-group">
              <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                <Building2 className="w-4 h-4" />
                Select Project *
              </label>
              <select
                value={selectedProject}
                onChange={(e) => {
                  setSelectedProject(e.target.value);
                  setSelectedTask(''); // Reset task selection when project changes
                }}
                required
                className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="" className="bg-surface-elevated">Choose a project...</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id} className="bg-surface-elevated">
                    {project.name}
                  </option>
                ))}
              </select>
              {loading && (
                <p className="text-sm text-muted-foreground mt-1">Loading projects...</p>
              )}
            </div>

            {/* Task Selection */}
            <div className="form-group">
              <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                <Target className="w-4 h-4" />
                Select Task (Optional)
              </label>
              <select
                value={selectedTask}
                onChange={(e) => setSelectedTask(e.target.value)}
                disabled={!selectedProject}
                className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
              >
                <option value="" className="bg-surface-elevated">
                  {selectedProject ? 'Choose a task...' : 'Select a project first'}
                </option>
                {filteredTasks.map((task) => (
                  <option key={task.id} value={task.id} className="bg-surface-elevated">
                    {task.title}
                  </option>
                ))}
              </select>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedProject ? `${filteredTasks.length} task(s) available` : 'Tasks will appear after selecting a project'}
              </p>
            </div>

            {/* Report Description */}
            <div className="form-group">
              <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                <FileText className="w-4 h-4" />
                Report Description *
              </label>
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                required
                rows={5}
                placeholder="Describe the progress, issues, achievements, or any important information about this project/task..."
                className="w-full p-3 bg-surface-elevated border border-border rounded-lg text-white placeholder-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
              />
              <p className="text-sm text-muted-foreground mt-1">
                {reportDescription.length}/1000 characters
              </p>
            </div>

            {/* Image Upload */}
            <div className="form-group">
              <label className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
                <ImageIcon className="w-4 h-4" />
                Upload Screenshot/Image (Optional)
              </label>

              {!imagePreview ? (
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag and drop an image here, or click to select
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-lg cursor-pointer transition-colors inline-block"
                  >
                    Choose Image
                  </label>
                  <p className="text-xs text-muted-foreground mt-2">
                    Supports JPG, PNG, GIF up to 5MB
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative border border-border rounded-lg p-4 bg-surface-elevated">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-w-full h-48 object-contain mx-auto rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {uploadedImage?.name} ({(uploadedImage?.size! / 1024 / 1024).toFixed(2)} MB)
                  </p>
                </div>
              )}
            </div>

            {/* Selected Project/Task Preview */}
            {selectedProject && (
              <div className="form-group">
                <label className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
                  <Target className="w-4 h-4" />
                  Report Summary
                </label>
                <div className="p-4 glass-surface rounded-lg space-y-3">
                  {(() => {
                    const project = projects.find(p => p.id === selectedProject);
                    const task = selectedTask ? tasks.find(t => t.id === selectedTask) : null;

                    return (
                      <>
                        <div>
                          <h4 className="font-semibold text-white mb-1">Project: {project?.name}</h4>
                          <p className="text-sm text-muted-foreground">{project?.description}</p>
                        </div>
                        {task && (
                          <div>
                            <h4 className="font-semibold text-white mb-1">Task: {task.title}</h4>
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                            <div className="flex gap-2 mt-2">
                              <span className={cn(
                                "px-2 py-1 text-xs rounded",
                                task.status === 'completed' ? 'bg-success/20 text-success' :
                                task.status === 'in_progress' ? 'bg-info/20 text-info' :
                                'bg-warning/20 text-warning'
                              )}>
                                {task.status.replace('_', ' ')}
                              </span>
                              <span className={cn(
                                "px-2 py-1 text-xs rounded",
                                task.priority === 'Urgent' ? 'bg-red-500/20 text-red-400' :
                                task.priority === 'High' ? 'bg-orange-500/20 text-orange-400' :
                                task.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-green-500/20 text-green-400'
                              )}>
                                {task.priority}
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="modal-actions flex justify-end gap-3 pt-6 mt-6 border-t border-border">
            <button
              type="button"
              className="px-6 py-2 bg-surface-elevated hover:bg-muted border border-border rounded-lg text-white transition-all"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loading || !userName || !selectedProject || !reportDescription}
              className="px-6 py-2 rounded-lg text-white font-medium transition-all flex items-center gap-2 shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #646cff, #8b5cf6)' }}
            >
              <Save size={16} />
              {submitting ? 'Creating Report...' : 'Create Report'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}