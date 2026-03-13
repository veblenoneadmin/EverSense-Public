import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Plus,
  Search,
  Calendar as CalendarIcon,
  DollarSign,
  Receipt,
  Upload,
  Filter,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  MoreVertical,
  Paperclip
} from 'lucide-react';
import { format } from 'date-fns';

const ExpensesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [filterStatus, setFilterStatus] = useState('all');

  // Mock expense data
  const expenses = [
    {
      id: '1',
      date: '2024-01-20',
      description: 'Software License - Adobe Creative Suite',
      category: 'Software',
      amount: 599,
      project: 'Website Redesign',
      client: 'TechCorp Inc.',
      status: 'approved',
      billable: true,
      receipt: true,
      submittedDate: '2024-01-20',
      approvedDate: '2024-01-21'
    },
    {
      id: '2',
      date: '2024-01-18',
      description: 'Client Meeting Lunch',
      category: 'Meals',
      amount: 125,
      project: 'Mobile App Development',
      client: 'StartupXYZ',
      status: 'pending',
      billable: true,
      receipt: true,
      submittedDate: '2024-01-19'
    },
    {
      id: '3',
      date: '2024-01-15',
      description: 'Office Supplies - Notebooks and Pens',
      category: 'Office Supplies',
      amount: 45,
      project: null,
      client: null,
      status: 'approved',
      billable: false,
      receipt: false,
      submittedDate: '2024-01-15',
      approvedDate: '2024-01-16'
    },
    {
      id: '4',
      date: '2024-01-12',
      description: 'Travel - Flight to Client Site',
      category: 'Travel',
      amount: 890,
      project: 'E-commerce Platform',
      client: 'RetailCorp',
      status: 'rejected',
      billable: true,
      receipt: true,
      submittedDate: '2024-01-13',
      rejectedDate: '2024-01-14'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-warning/20 text-warning';
      case 'approved': return 'bg-success/20 text-success';
      case 'rejected': return 'bg-destructive/20 text-destructive';
      default: return 'bg-muted/20 text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      default: return <Receipt className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Software': return 'bg-info/20 text-info';
      case 'Travel': return 'bg-warning/20 text-warning';
      case 'Meals': return 'bg-success/20 text-success';
      case 'Office Supplies': return 'bg-muted/20 text-muted-foreground';
      default: return 'bg-primary/20 text-primary';
    }
  };

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (expense.project && expense.project.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterStatus === 'all' || expense.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const totalExpenses = expenses.length;
  const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const approvedAmount = expenses.filter(exp => exp.status === 'approved').reduce((sum, exp) => sum + exp.amount, 0);
  const pendingAmount = expenses.filter(exp => exp.status === 'pending').reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Expenses</h1>
          <p className="text-muted-foreground mt-2">Track and manage your business expenses</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button className="bg-gradient-primary hover:shadow-lg">
            <Plus className="h-4 w-4 mr-2" />
            New Expense
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="glass">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-3xl font-bold">{totalExpenses}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center">
                <Receipt className="h-6 w-6 text-white" />
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
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-3xl font-bold text-success">${approvedAmount.toLocaleString()}</p>
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
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-3xl font-bold text-warning">${pendingAmount.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-gradient-warning flex items-center justify-center">
                <Clock className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="glass p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <div className="flex gap-2">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('all')}
              size="sm"
            >
              All
            </Button>
            <Button
              variant={filterStatus === 'pending' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('pending')}
              size="sm"
            >
              Pending
            </Button>
            <Button
              variant={filterStatus === 'approved' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('approved')}
              size="sm"
            >
              Approved
            </Button>
            <Button
              variant={filterStatus === 'rejected' ? 'default' : 'outline'}
              onClick={() => setFilterStatus('rejected')}
              size="sm"
            >
              Rejected
            </Button>
          </div>
        </div>
      </Card>

      {/* Expenses List */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Expense Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredExpenses.map((expense) => (
              <div key={expense.id} className="p-4 bg-surface-elevated rounded-lg hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(expense.status)}
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(expense.date), 'MMM dd, yyyy')}
                      </span>
                    </div>
                    <Badge className={getStatusColor(expense.status)} variant="outline">
                      {expense.status.toUpperCase()}
                    </Badge>
                    <Badge className={getCategoryColor(expense.category)} variant="outline">
                      {expense.category}
                    </Badge>
                    {expense.billable && (
                      <Badge className="bg-success/20 text-success" variant="outline">
                        Billable
                      </Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="font-semibold">{expense.description}</p>
                    {expense.project && (
                      <p className="text-sm text-muted-foreground">
                        {expense.project} • {expense.client}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="font-semibold text-xl">${expense.amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Receipt</p>
                    <div className="flex items-center space-x-2">
                      {expense.receipt ? (
                        <>
                          <Paperclip className="h-4 w-4 text-success" />
                          <span className="text-sm text-success">Attached</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">No receipt</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <span>Submitted: {format(new Date(expense.submittedDate), 'MMM dd')}</span>
                    {expense.approvedDate && (
                      <span>Approved: {format(new Date(expense.approvedDate), 'MMM dd')}</span>
                    )}
                    {expense.rejectedDate && (
                      <span>Rejected: {format(new Date(expense.rejectedDate), 'MMM dd')}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">Edit</Button>
                    <Button size="sm" variant="outline">
                      <Upload className="h-4 w-4 mr-2" />
                      Receipt
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredExpenses.length === 0 && (
            <div className="text-center py-12">
              <Receipt className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Expenses Found</h3>
              <p className="text-muted-foreground mb-6">
                {searchTerm || filterStatus !== 'all' 
                  ? 'No expenses match your current filters.' 
                  : 'Start tracking your business expenses.'}
              </p>
              <Button className="bg-gradient-primary hover:shadow-lg">
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpensesPage;