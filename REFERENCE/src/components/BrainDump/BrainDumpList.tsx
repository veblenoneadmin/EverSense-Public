import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar,
  Edit,
  Trash2,
  Search,
  Brain,
  Clock,
  CheckCircle2,
  XCircle,
  Filter
} from 'lucide-react';
import { useBrainDumps, useUpdateBrainDump, useDeleteBrainDump } from '@/hooks/useDatabase';
import { format } from 'date-fns';

const BrainDumpList: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const { data: brainDumps, isLoading } = useBrainDumps();
  const updateBrainDump = useUpdateBrainDump();
  const deleteBrainDump = useDeleteBrainDump();

  const filteredDumps = brainDumps?.filter(dump => {
    const matchesSearch = dump.raw_content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = selectedFilter === 'all' || 
                         (selectedFilter === 'processed' && dump.processed) ||
                         (selectedFilter === 'unprocessed' && !dump.processed);
    return matchesSearch && matchesFilter;
  }) || [];

  const handleEdit = (dump: any) => {
    setEditingId(dump.id);
    setEditContent(dump.raw_content);
  };

  const handleSave = async (id: string) => {
    try {
      await updateBrainDump.mutateAsync({
        id,
        updates: { raw_content: editContent }
      });
      setEditingId(null);
      setEditContent('');
    } catch (error) {
      console.error('Failed to update brain dump:', error);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this brain dump?')) {
      try {
        await deleteBrainDump.mutateAsync(id);
      } catch (error) {
        console.error('Failed to delete brain dump:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface-elevated rounded w-1/4"></div>
          <div className="h-32 bg-surface-elevated rounded"></div>
          <div className="h-32 bg-surface-elevated rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold gradient-text">Previous Brain Dumps</h2>
          <p className="text-muted-foreground mt-1">Review and edit your past thoughts</p>
        </div>
        <Badge variant="outline" className="text-sm">
          {filteredDumps.length} Dumps
        </Badge>
      </div>

      {/* Filters */}
      <Card className="glass">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search brain dumps..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <select 
                className="w-full p-2 border border-border rounded-md bg-background"
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
              >
                <option value="all">All Dumps</option>
                <option value="processed">Processed</option>
                <option value="unprocessed">Unprocessed</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brain Dumps List */}
      <div className="space-y-4">
        {filteredDumps.map((dump) => (
          <Card key={dump.id} className="glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                    <Brain className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      Brain Dump from {format(new Date(dump.created_at), 'MMM dd, yyyy')}
                    </CardTitle>
                    <div className="flex items-center space-x-4 mt-1">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 mr-1" />
                        {format(new Date(dump.created_at), 'h:mm a')}
                      </div>
                      {dump.processed ? (
                        <Badge className="bg-success/10 text-success border-success">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Processed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          <XCircle className="h-3 w-3 mr-1" />
                          Unprocessed
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {editingId === dump.id ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleSave(dump.id)}
                        disabled={updateBrainDump.isPending}
                        className="bg-success hover:bg-success/90"
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancel}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(dump)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(dump.id)}
                        disabled={deleteBrainDump.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {editingId === dump.id ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full min-h-[150px] p-4 bg-surface-elevated border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                />
              ) : (
                <div className="bg-surface-elevated p-4 rounded-lg">
                  <p className="text-foreground whitespace-pre-wrap">
                    {dump.raw_content}
                  </p>
                </div>
              )}
              
              <Separator className="my-4" />
              
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div>
                  {dump.raw_content.length} characters • {dump.raw_content.split(' ').filter(word => word.length > 0).length} words
                </div>
                {dump.ai_analysis_complete && (
                  <div className="flex items-center">
                    <CheckCircle2 className="h-4 w-4 mr-1 text-success" />
                    AI Analysis Complete
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredDumps.length === 0 && (
        <Card className="glass">
          <CardContent className="text-center py-12">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchTerm ? 'No brain dumps found matching your search' : 'No brain dumps yet'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BrainDumpList;