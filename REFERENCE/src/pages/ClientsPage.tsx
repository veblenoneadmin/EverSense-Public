import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Plus,
  Search,
  Mail,
  Phone,
  MapPin,
  Building,
  DollarSign,
  Clock,
  Users,
  MoreVertical,
  Globe,
  Calendar
} from 'lucide-react';

const ClientsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Mock client data
  const clients = [
    {
      id: '1',
      company: 'TechCorp Inc.',
      contact: 'John Smith',
      email: 'john@techcorp.com',
      phone: '+1 (555) 123-4567',
      address: '123 Tech Street, San Francisco, CA',
      website: 'www.techcorp.com',
      status: 'active',
      projects: 3,
      totalValue: 85000,
      hoursWorked: 320,
      lastProject: '2024-01-15',
      hourlyRate: 85,
      paymentTerms: 30
    },
    {
      id: '2',
      company: 'StartupXYZ',
      contact: 'Sarah Johnson',
      email: 'sarah@startupxyz.com',
      phone: '+1 (555) 987-6543',
      address: '456 Innovation Ave, Austin, TX',
      website: 'www.startupxyz.com',
      status: 'active',
      projects: 1,
      totalValue: 25000,
      hoursWorked: 120,
      lastProject: '2024-01-10',
      hourlyRate: 90,
      paymentTerms: 15
    },
    {
      id: '3',
      company: 'RetailCorp',
      contact: 'Mike Davis',
      email: 'mike@retailcorp.com',
      phone: '+1 (555) 456-7890',
      address: '789 Commerce Blvd, New York, NY',
      website: 'www.retailcorp.com',
      status: 'inactive',
      projects: 2,
      totalValue: 120000,
      hoursWorked: 580,
      lastProject: '2023-12-01',
      hourlyRate: 95,
      paymentTerms: 45
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success/20 text-success';
      case 'inactive': return 'bg-muted/20 text-muted-foreground';
      case 'prospect': return 'bg-info/20 text-info';
      default: return 'bg-muted/20 text-muted-foreground';
    }
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || client.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const totalClients = clients.length;
  const activeClients = clients.filter(c => c.status === 'active').length;
  const totalRevenue = clients.reduce((sum, c) => sum + c.totalValue, 0);
  const totalHours = clients.reduce((sum, c) => sum + c.hoursWorked, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Clients</h1>
          <p className="text-muted-foreground mt-2">Manage your client relationships and projects</p>
        </div>
        <Button 
          className="bg-gradient-primary hover:shadow-lg"
          onClick={() => toast.success("Client creation form would open here")}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Client
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Clients</p>
                <p className="text-3xl font-bold">{totalClients}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                <Building className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Clients</p>
                <p className="text-3xl font-bold text-success">{activeClients}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-success flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-3xl font-bold text-success">${totalRevenue.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-success flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-3xl font-bold">{totalHours}h</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-info flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="glass p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('all')}
              size="sm"
            >
              All
            </Button>
            <Button
              variant={filterStatus === 'active' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('active')}
              size="sm"
            >
              Active
            </Button>
            <Button
              variant={filterStatus === 'inactive' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('inactive')}
              size="sm"
            >
              Inactive
            </Button>
          </div>
        </div>
      </Card>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredClients.map((client) => (
          <Card key={client.id} className="glass hover:shadow-lg transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                    <Building className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg truncate">{client.company}</h3>
                    <p className="text-sm text-muted-foreground">{client.contact}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getStatusColor(client.status)} variant="outline">
                    {client.status.toUpperCase()}
                  </Badge>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Contact Info */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{client.email}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{client.phone}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{client.address}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate text-primary">{client.website}</span>
                </div>
              </div>

              {/* Project Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-surface-elevated rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Projects</span>
                    <span className="font-semibold">{client.projects}</span>
                  </div>
                </div>
                <div className="p-3 bg-surface-elevated rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Hours</span>
                    <span className="font-semibold">{client.hoursWorked}h</span>
                  </div>
                </div>
              </div>

              {/* Financial Info */}
              <div className="p-3 bg-surface-elevated rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Total Value</span>
                  <span className="font-semibold text-success">${client.totalValue.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Hourly Rate</span>
                  <span className="font-semibold">${client.hourlyRate}/hr</span>
                </div>
              </div>

              {/* Last Project */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  Last Project
                </span>
                <span>{new Date(client.lastProject).toLocaleDateString()}</span>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => window.open(`mailto:${client.email}`, '_blank')}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Contact
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => navigate('/projects')}
                >
                  View Projects
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredClients.length === 0 && (
        <Card className="glass p-12 text-center">
          <Building className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Clients Found</h3>
          <p className="text-muted-foreground mb-6">
            {searchTerm || filterStatus !== 'all' 
              ? 'No clients match your current filters.' 
              : 'Start building your client base by adding your first client.'}
          </p>
          <Button 
            className="bg-gradient-primary hover:shadow-lg"
            onClick={() => toast.success("Client creation form would open here")}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Client
          </Button>
        </Card>
      )}
    </div>
  );
};

export default ClientsPage;