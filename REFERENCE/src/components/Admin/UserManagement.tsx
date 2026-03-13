import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Users, 
  Search, 
  Filter,
  Shield,
  Crown,
  User,
  Building,
  Settings,
  CheckCircle2,
  XCircle,
  Edit,
  Save,
  X
} from 'lucide-react';
import { useAllUsers, useUpdateUserRole, useProfile } from '@/hooks/useDatabase';
import { dataMasking, auditSensitiveAccess } from '@/lib/data-masking';

const UserManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const { data: users, isLoading } = useAllUsers();
  const { data: currentProfile } = useProfile();
  const updateUserRole = useUpdateUserRole();

  // Apply data masking to user data
  const maskedUsers = users?.map(user => {
    const isOwnProfile = user.user_id === currentProfile?.user_id;
    return dataMasking.maskProfileData(user, currentProfile?.role || 'employee', isOwnProfile);
  }) || [];

  const filteredUsers = maskedUsers.filter(user => {
    const matchesSearch = user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'all' || user.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const handleEditUser = (user: any) => {
    // Log sensitive data access
    auditSensitiveAccess('edit_user_attempt', 'profiles', user.user_id, currentProfile?.role || 'employee');
    
    setEditingUser(user.user_id);
    setEditForm({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
      is_active: user.is_active
    });
  };

  const handleSaveUser = async (userId: string) => {
    try {
      await updateUserRole.mutateAsync({
        userId,
        role: editForm.role
      });
      setEditingUser(null);
      setEditForm({});
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditForm({});
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Crown className="h-4 w-4" />;
      case 'client': return <Building className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-error text-error-foreground';
      case 'client': return 'bg-warning text-warning-foreground';
      default: return 'bg-info text-info-foreground';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface-elevated rounded w-1/4"></div>
          <div className="h-64 bg-surface-elevated rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">User Management</h1>
          <p className="text-muted-foreground mt-2">Manage user roles and permissions</p>
        </div>
        <Badge variant="outline" className="text-sm">
          <Users className="h-4 w-4 mr-2" />
          {filteredUsers.length} Users
        </Badge>
      </div>

      {/* Filters */}
      <Card className="glass">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Users</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <Label htmlFor="role-filter">Filter by Role</Label>
              <select 
                id="role-filter"
                className="w-full mt-2 p-2 border border-border rounded-md bg-background"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="employee">Employee</option>
                <option value="client">Client</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Users & Permissions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <div key={user.user_id} className="p-4 border border-border rounded-lg bg-surface-elevated/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={user.avatar_url} />
                      <AvatarFallback>
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="space-y-1">
                      {editingUser === user.user_id ? (
                        <div className="space-y-2">
                          <div className="flex space-x-2">
                            <Input
                              value={editForm.first_name}
                              onChange={(e) => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                              placeholder="First Name"
                              className="w-32"
                            />
                            <Input
                              value={editForm.last_name}
                              onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                              placeholder="Last Name"
                              className="w-32"
                            />
                          </div>
                          <Input
                            value={editForm.email}
                            onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="Email"
                            className="w-64"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="font-semibold text-foreground">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                        </>
                      )}
                      
                      <div className="flex items-center space-x-2 mt-2">
                        {editingUser === user.user_id ? (
                          <select
                            value={editForm.role}
                            onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                            className="p-1 border border-border rounded bg-background text-sm"
                          >
                            <option value="employee">Employee</option>
                            <option value="client">Client</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          <Badge variant="outline" className={getRoleColor(user.role)}>
                            {getRoleIcon(user.role)}
                            <span className="ml-1 capitalize">{user.role}</span>
                          </Badge>
                        )}
                        
                        {user.is_active ? (
                          <Badge variant="outline" className="text-success border-success">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground border-muted">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {editingUser === user.user_id ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleSaveUser(user.user_id)}
                          disabled={updateUserRole.isPending}
                          className="bg-success hover:bg-success/90"
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEdit}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditUser(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {editingUser === user.user_id && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-4">
                      <h4 className="font-semibold text-foreground">Permissions</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`can-view-analytics-${user.user_id}`} className="text-sm">
                            View Analytics
                          </Label>
                          <Switch
                            id={`can-view-analytics-${user.user_id}`}
                            checked={editForm.role === 'admin'}
                            disabled={true}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`can-manage-users-${user.user_id}`} className="text-sm">
                            Manage Users
                          </Label>
                          <Switch
                            id={`can-manage-users-${user.user_id}`}
                            checked={editForm.role === 'admin'}
                            disabled={true}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`can-view-reports-${user.user_id}`} className="text-sm">
                            View Reports
                          </Label>
                          <Switch
                            id={`can-view-reports-${user.user_id}`}
                            checked={editForm.role !== 'client'}
                            disabled={true}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`can-create-projects-${user.user_id}`} className="text-sm">
                            Create Projects
                          </Label>
                          <Switch
                            id={`can-create-projects-${user.user_id}`}
                            checked={editForm.role === 'admin' || editForm.role === 'employee'}
                            disabled={true}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`can-manage-billing-${user.user_id}`} className="text-sm">
                            Manage Billing
                          </Label>
                          <Switch
                            id={`can-manage-billing-${user.user_id}`}
                            checked={editForm.role === 'admin'}
                            disabled={true}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor={`can-export-data-${user.user_id}`} className="text-sm">
                            Export Data
                          </Label>
                          <Switch
                            id={`can-export-data-${user.user_id}`}
                            checked={editForm.role === 'admin' || editForm.role === 'employee'}
                            disabled={true}
                          />
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        * Permissions are automatically assigned based on user role
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No users found matching your criteria</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;