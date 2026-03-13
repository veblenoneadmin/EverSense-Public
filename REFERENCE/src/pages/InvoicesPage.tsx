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
  Download,
  Send,
  Eye,
  Edit,
  FileText,
  Calendar,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  MoreVertical
} from 'lucide-react';

const InvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Mock invoice data
  const invoices = [
    {
      id: '1',
      number: 'INV-2024-001',
      client: 'TechCorp Inc.',
      project: 'Website Redesign',
      issueDate: '2024-01-15',
      dueDate: '2024-02-14',
      amount: 12750,
      status: 'paid',
      hours: 150,
      hourlyRate: 85
    },
    {
      id: '2',
      number: 'INV-2024-002',
      client: 'StartupXYZ',
      project: 'Mobile App Development',
      issueDate: '2024-01-20',
      dueDate: '2024-02-19',
      amount: 8100,
      status: 'sent',
      hours: 90,
      hourlyRate: 90
    },
    {
      id: '3',
      number: 'INV-2024-003',
      client: 'RetailCorp',
      project: 'E-commerce Platform',
      issueDate: '2024-01-10',
      dueDate: '2024-01-25',
      amount: 19000,
      status: 'overdue',
      hours: 200,
      hourlyRate: 95
    },
    {
      id: '4',
      number: 'INV-2024-004',
      client: 'TechCorp Inc.',
      project: 'Website Maintenance',
      issueDate: '2024-01-25',
      dueDate: '2024-02-24',
      amount: 3400,
      status: 'draft',
      hours: 40,
      hourlyRate: 85
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-muted/20 text-muted-foreground';
      case 'sent': return 'bg-info/20 text-info';
      case 'paid': return 'bg-success/20 text-success';
      case 'overdue': return 'bg-destructive/20 text-destructive';
      case 'cancelled': return 'bg-muted/20 text-muted-foreground';
      default: return 'bg-muted/20 text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Edit className="h-4 w-4" />;
      case 'sent': return <Send className="h-4 w-4" />;
      case 'paid': return <CheckCircle className="h-4 w-4" />;
      case 'overdue': return <AlertCircle className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.project.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || invoice.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const totalInvoices = invoices.length;
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const paidAmount = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
  const outstandingAmount = invoices.filter(inv => inv.status === 'sent' || inv.status === 'overdue').reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Invoices</h1>
          <p className="text-muted-foreground mt-2">Create and manage your invoices</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline"
            onClick={() => toast.success("Export functionality would be implemented here")}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button 
            className="bg-gradient-primary hover:shadow-lg"
            onClick={() => toast.success("Invoice creation form would open here")}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Invoices</p>
                <p className="text-3xl font-bold">{totalInvoices}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                <FileText className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-3xl font-bold">${totalAmount.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-info flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-3xl font-bold text-success">${paidAmount.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-success flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-3xl font-bold text-warning">${outstandingAmount.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-warning flex items-center justify-center">
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
                placeholder="Search invoices..."
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
              variant={filterStatus === 'draft' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('draft')}
              size="sm"
            >
              Draft
            </Button>
            <Button
              variant={filterStatus === 'sent' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('sent')}
              size="sm"
            >
              Sent
            </Button>
            <Button
              variant={filterStatus === 'paid' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('paid')}
              size="sm"
            >
              Paid
            </Button>
            <Button
              variant={filterStatus === 'overdue' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('overdue')}
              size="sm"
            >
              Overdue
            </Button>
          </div>
        </div>
      </Card>

      {/* Invoices Table */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Invoice List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredInvoices.map((invoice) => (
              <div key={invoice.id} className="p-4 bg-surface-elevated rounded-lg hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(invoice.status)}
                      <span className="font-mono font-semibold">{invoice.number}</span>
                    </div>
                    <Badge className={getStatusColor(invoice.status)} variant="outline">
                      {invoice.status.toUpperCase()}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Client</p>
                    <p className="font-semibold">{invoice.client}</p>
                    <p className="text-sm text-muted-foreground">{invoice.project}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="font-semibold text-xl">${invoice.amount.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">{invoice.hours}h @ ${invoice.hourlyRate}/hr</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Issue Date</p>
                    <p className="font-semibold">{new Date(invoice.issueDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className="font-semibold">{new Date(invoice.dueDate).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Due in {Math.ceil((new Date(invoice.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => toast.info("Invoice preview would open here")}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => toast.success("Invoice sent successfully!")}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => toast.success("PDF downloaded successfully!")}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      PDF
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredInvoices.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Invoices Found</h3>
              <p className="text-muted-foreground mb-6">
                {searchTerm || filterStatus !== 'all' 
                  ? 'No invoices match your current filters.' 
                  : 'Create your first invoice to get started.'}
              </p>
              <Button 
                className="bg-gradient-primary hover:shadow-lg"
                onClick={() => toast.success("Invoice creation form would open here")}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoicesPage;