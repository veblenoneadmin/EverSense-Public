import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useDatabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Clock, 
  Calendar, 
  Brain,
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Timer,
  Building2,
  Users,
  FileText,
  DollarSign
} from 'lucide-react';
import veblenLogo from '@/assets/veblen-logo.png';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

// Navigation based on user roles
const getNavigationForRole = (role: string) => {
  const baseNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
    { name: 'Brain Dump', href: '/brain-dump', icon: Brain },
    { name: 'Active Timer', href: '/timer', icon: Timer },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare },
    { name: 'Calendar', href: '/calendar', icon: Calendar },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  if (role === 'admin') {
    return [
      ...baseNavigation,
      { name: 'Projects', href: '/projects', icon: Building2 },
      { name: 'Time Logs', href: '/timesheets', icon: Clock },
      { name: 'Clients', href: '/clients', icon: Users },
      { name: 'Invoices', href: '/invoices', icon: FileText },
      { name: 'Expenses', href: '/expenses', icon: DollarSign },
      { name: 'Reports', href: '/reports', icon: BarChart3 },
    ];
  }

  if (role === 'manager') {
    return [
      ...baseNavigation,
      { name: 'Projects', href: '/projects', icon: Building2 },
      { name: 'Time Logs', href: '/timesheets', icon: Clock },
      { name: 'Reports', href: '/reports', icon: BarChart3 },
    ];
  }

  // Staff/employee - basic features only
  return baseNavigation;
};

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      logger.error('Sign out failed');
      // Still try to redirect user on sign out error
      window.location.href = '/login';
    }
  };

  // Get user initials
  const getInitials = (email: string) => {
    return email
      .split('@')[0]
      .split('.')
      .map(name => name.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-72 glass-surface border-r border-border">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center px-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center">
              <img src={veblenLogo} alt="VebTask Logo" className="h-10 w-10 object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-bold gradient-text">VebTask</h1>
              <p className="text-xs text-muted-foreground">AI-Powered Task Management</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {getNavigationForRole(profile?.role || 'employee').map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group",
                  "hover:bg-surface-elevated hover:text-foreground",
                  isActive 
                    ? "bg-gradient-primary text-white shadow-lg glow-primary" 
                    : "text-muted-foreground hover:bg-surface-elevated/80"
                )}
              >
                <Icon className={cn(
                  "mr-3 h-5 w-5 transition-transform duration-200", 
                  isActive && "text-white",
                  !isActive && "group-hover:scale-110"
                )} />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center space-x-3 p-3 rounded-lg bg-surface-elevated">
            <Avatar className="h-10 w-10">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="bg-gradient-primary text-white font-medium">
                {user?.email ? getInitials(user.email) : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium text-foreground truncate">
                  {profile?.first_name && profile?.last_name 
                    ? `${profile.first_name} ${profile.last_name}`
                    : user?.email?.split('@')[0] || 'User'
                  }
                </p>
                <Badge variant="outline" className="text-xs capitalize">
                  {profile?.role || 'employee'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="h-8 w-8 p-0 hover:bg-error/10 hover:text-error"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;