import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  User,
  Bell,
  Shield,
  Palette,
  Globe,
  DollarSign,
  Clock,
  Save,
  Upload,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import UserManagement from '@/components/Admin/UserManagement';

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', user.id)
          .single();
        
        setIsAdmin(profile?.role === 'admin');
      }
    };
    
    checkAdminStatus();
  }, [user?.id]);
  
  // Mock settings data
  const [settings, setSettings] = useState({
    profile: {
      firstName: 'John',
      lastName: 'Doe',
      email: user?.email || 'john.doe@example.com',
      phone: '+1 (555) 123-4567',
      timezone: 'America/New_York',
      avatar: ''
    },
    notifications: {
      emailNotifications: true,
      taskReminders: true,
      projectUpdates: false,
      weeklyReports: true,
      marketingEmails: false
    },
    privacy: {
      profileVisible: true,
      activityVisible: false,
      twoFactorEnabled: false
    },
    billing: {
      defaultHourlyRate: 85,
      currency: 'USD',
      taxRate: 8.25,
      invoicePrefix: 'INV',
      paymentTerms: 30
    },
    preferences: {
      darkMode: false,
      compactMode: false,
      autoSave: true,
      timeFormat: '12h',
      dateFormat: 'MM/DD/YYYY'
    }
  });

  const handleSettingChange = (section: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [key]: value
      }
    }));
  };

  const handleSave = () => {
    // Here you would save the settings to your backend
    console.log('Saving settings:', settings);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your account and application preferences</p>
        </div>
        <Button className="bg-gradient-primary hover:shadow-lg" onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 border-b border-border">
        <button
          className={`px-4 py-2 border-b-2 transition-colors ${
            activeTab === 'profile' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('profile')}
        >
          Profile Settings
        </button>
        {isAdmin && (
          <button
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'admin' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('admin')}
          >
            <Shield className="h-4 w-4 mr-2 inline" />
            User Management
          </button>
        )}
      </div>

      {activeTab === 'admin' && isAdmin ? (
        <UserManagement />
      ) : (

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Settings */}
        <Card className="glass lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Profile Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Section */}
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={settings.profile.avatar} />
                <AvatarFallback className="text-lg">
                  {settings.profile.firstName[0]}{settings.profile.lastName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <Button size="sm" variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Photo
                </Button>
                <Button size="sm" variant="outline">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              </div>
            </div>

            <Separator />

            {/* Profile Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={settings.profile.firstName}
                  onChange={(e) => handleSettingChange('profile', 'firstName', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={settings.profile.lastName}
                  onChange={(e) => handleSettingChange('profile', 'lastName', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={settings.profile.email}
                onChange={(e) => handleSettingChange('profile', 'email', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={settings.profile.phone}
                onChange={(e) => handleSettingChange('profile', 'phone', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <select 
                id="timezone" 
                className="w-full p-2 border border-border rounded-md bg-background"
                value={settings.profile.timezone}
                onChange={(e) => handleSettingChange('profile', 'timezone', e.target.value)}
              >
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="UTC">UTC</option>
              </select>
            </div>

            <Separator />

            {/* Password Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Change Password</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter current password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="Enter new password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Update Password
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Side Panel Settings */}
        <div className="space-y-6">
          {/* Notifications */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Notifications</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(settings.notifications).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <Label htmlFor={key} className="text-sm">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </Label>
                  <Switch
                    id={key}
                    checked={value}
                    onCheckedChange={(checked) => handleSettingChange('notifications', key, checked)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Privacy */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Privacy & Security</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(settings.privacy).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <Label htmlFor={key} className="text-sm">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </Label>
                  <Switch
                    id={key}
                    checked={value}
                    onCheckedChange={(checked) => handleSettingChange('privacy', key, checked)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Billing */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="h-5 w-5" />
                <span>Billing</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hourlyRate">Default Hourly Rate</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  value={settings.billing.defaultHourlyRate}
                  onChange={(e) => handleSettingChange('billing', 'defaultHourlyRate', Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <select 
                  id="currency" 
                  className="w-full p-2 border border-border rounded-md bg-background"
                  value={settings.billing.currency}
                  onChange={(e) => handleSettingChange('billing', 'currency', e.target.value)}
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentTerms">Payment Terms (days)</Label>
                <Input
                  id="paymentTerms"
                  type="number"
                  value={settings.billing.paymentTerms}
                  onChange={(e) => handleSettingChange('billing', 'paymentTerms', Number(e.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Palette className="h-5 w-5" />
                <span>Preferences</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="darkMode" className="text-sm">Dark Mode</Label>
                <Switch
                  id="darkMode"
                  checked={settings.preferences.darkMode}
                  onCheckedChange={(checked) => handleSettingChange('preferences', 'darkMode', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="compactMode" className="text-sm">Compact Mode</Label>
                <Switch
                  id="compactMode"
                  checked={settings.preferences.compactMode}
                  onCheckedChange={(checked) => handleSettingChange('preferences', 'compactMode', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="autoSave" className="text-sm">Auto Save</Label>
                <Switch
                  id="autoSave"
                  checked={settings.preferences.autoSave}
                  onCheckedChange={(checked) => handleSettingChange('preferences', 'autoSave', checked)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timeFormat">Time Format</Label>
                <select 
                  id="timeFormat" 
                  className="w-full p-2 border border-border rounded-md bg-background"
                  value={settings.preferences.timeFormat}
                  onChange={(e) => handleSettingChange('preferences', 'timeFormat', e.target.value)}
                >
                  <option value="12h">12 Hour</option>
                  <option value="24h">24 Hour</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      )}
    </div>
  );
};

export default SettingsPage;