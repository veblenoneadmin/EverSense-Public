import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const VEBLEN_USERS = [
  {
    email: 'founder@veblen.com',
    name: 'Jordan Veblen',
    role: 'OWNER',
    password: 'veblen2024',
    title: 'Founder & CEO'
  },
  {
    email: 'sarah@veblen.com',
    name: 'Sarah Mitchell',
    role: 'ADMIN',
    password: 'veblen2024',
    title: 'Head of Operations'
  },
  {
    email: 'alex@veblen.com',
    name: 'Alex Rodriguez',
    role: 'ADMIN', 
    password: 'veblen2024',
    title: 'Lead Developer'
  },
  {
    email: 'emma@veblen.com',
    name: 'Emma Thompson',
    role: 'STAFF',
    password: 'veblen2024',
    title: 'Senior Product Designer'
  },
  {
    email: 'marcus@veblen.com',
    name: 'Marcus Chen',
    role: 'STAFF',
    password: 'veblen2024',
    title: 'Full-Stack Developer'
  },
  {
    email: 'lisa@veblen.com',
    name: 'Lisa Park',
    role: 'STAFF',
    password: 'veblen2024',
    title: 'Project Manager'
  },
  {
    email: 'david@veblen.com',
    name: 'David Johnson',
    role: 'STAFF',
    password: 'veblen2024',
    title: 'DevOps Engineer'
  },
  {
    email: 'rachel@veblen.com',
    name: 'Rachel Kim',
    role: 'STAFF',
    password: 'veblen2024',
    title: 'UX Researcher'
  }
];

const VEBLEN_CLIENTS = [
  {
    name: 'InnovateTech Solutions',
    email: 'contact@innovatetech.com',
    company: 'InnovateTech Solutions',
    phone: '+1-555-TECH-01',
    contactPerson: 'Michael Stevens',
    industry: 'Technology',
    hourlyRate: 185.00,
    priority: 'high',
    status: 'active',
    address: '123 Innovation Drive, San Francisco, CA 94105',
    notes: 'Strategic enterprise client, focuses on AI and machine learning solutions'
  },
  {
    name: 'GreenFuture Corp',
    email: 'projects@greenfuture.com',
    company: 'GreenFuture Corp',
    phone: '+1-555-GREEN-1',
    contactPerson: 'Elena Rodriguez',
    industry: 'Renewable Energy',
    hourlyRate: 165.00,
    priority: 'high',
    status: 'active',
    address: '456 Sustainability Blvd, Portland, OR 97201',
    notes: 'Leading renewable energy company, values environmental impact tracking'
  },
  {
    name: 'MedTech Innovations',
    email: 'development@medtechinno.com',
    company: 'MedTech Innovations',
    phone: '+1-555-MED-001',
    contactPerson: 'Dr. James Wilson',
    industry: 'Healthcare Technology',
    hourlyRate: 195.00,
    priority: 'high',
    status: 'active',
    address: '789 Medical Center Way, Boston, MA 02101',
    notes: 'Healthcare technology startup, requires HIPAA compliance and security focus'
  },
  {
    name: 'FinanceFlow Systems',
    email: 'tech@financeflow.com',
    company: 'FinanceFlow Systems',
    phone: '+1-555-FIN-999',
    contactPerson: 'Amanda Foster',
    industry: 'Financial Services',
    hourlyRate: 175.00,
    priority: 'medium',
    status: 'active',
    address: '321 Wall Street, New York, NY 10005',
    notes: 'Fintech company requiring robust security and compliance measures'
  },
  {
    name: 'EduTech Academy',
    email: 'partnerships@edutechacad.com',
    company: 'EduTech Academy',
    phone: '+1-555-EDU-123',
    contactPerson: 'Professor Sarah Brown',
    industry: 'Education Technology',
    hourlyRate: 145.00,
    priority: 'medium',
    status: 'active',
    address: '654 Learning Lane, Austin, TX 78701',
    notes: 'Online education platform, focus on accessibility and user experience'
  },
  {
    name: 'RetailNext Analytics',
    email: 'dev@retailnext.com',
    company: 'RetailNext Analytics',
    phone: '+1-555-RET-456',
    contactPerson: 'Kevin Zhang',
    industry: 'Retail Analytics',
    hourlyRate: 155.00,
    priority: 'medium',
    status: 'potential',
    address: '987 Commerce St, Seattle, WA 98101',
    notes: 'Retail analytics platform, interested in real-time data processing solutions'
  }
];

const VEBLEN_PROJECTS = [
  {
    name: 'VebTask - Time Tracking Platform',
    description: 'Internal project to develop and maintain the VebTask time tracking and project management platform',
    status: 'active',
    priority: 'high',
    budget: 250000.00,
    spent: 127500.00,
    progress: 65,
    estimatedHours: 2000,
    hoursLogged: 1247,
    startDate: new Date('2024-08-01'),
    endDate: new Date('2025-06-30'),
    color: 'bg-violet-500',
    isInternal: true
  },
  {
    name: 'AI-Powered Healthcare Dashboard',
    description: 'Comprehensive healthcare analytics platform with AI-driven insights for MedTech Innovations',
    status: 'active',
    priority: 'high',
    budget: 180000.00,
    spent: 67500.00,
    progress: 35,
    estimatedHours: 1200,
    hoursLogged: 387,
    startDate: new Date('2024-11-01'),
    endDate: new Date('2025-05-15'),
    color: 'bg-blue-500'
  },
  {
    name: 'Smart Energy Management System',
    description: 'IoT-enabled energy management platform for renewable energy optimization',
    status: 'active',
    priority: 'high',
    budget: 220000.00,
    spent: 88000.00,
    progress: 40,
    estimatedHours: 1400,
    hoursLogged: 532,
    startDate: new Date('2024-10-15'),
    endDate: new Date('2025-07-30'),
    color: 'bg-green-500'
  },
  {
    name: 'Enterprise AI Integration Suite',
    description: 'AI/ML integration platform for enterprise clients with custom model deployment',
    status: 'active',
    priority: 'high',
    budget: 300000.00,
    spent: 45000.00,
    progress: 15,
    estimatedHours: 1800,
    hoursLogged: 243,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-12-31'),
    color: 'bg-purple-500'
  },
  {
    name: 'FinTech Security Compliance Platform',
    description: 'Comprehensive security and compliance management system for financial services',
    status: 'planning',
    priority: 'medium',
    budget: 165000.00,
    spent: 8250.00,
    progress: 5,
    estimatedHours: 1100,
    hoursLogged: 47,
    startDate: new Date('2025-02-01'),
    endDate: new Date('2025-09-30'),
    color: 'bg-indigo-500'
  },
  {
    name: 'Educational Content Management System',
    description: 'Modern learning management system with advanced analytics and accessibility features',
    status: 'planning',
    priority: 'medium',
    budget: 125000.00,
    spent: 6250.00,
    progress: 5,
    estimatedHours: 850,
    hoursLogged: 43,
    startDate: new Date('2025-03-01'),
    endDate: new Date('2025-11-15'),
    color: 'bg-orange-500'
  }
];

const VEBLEN_TASKS = [
  // VebTask Internal Project Tasks
  {
    title: 'Implement advanced time tracking analytics',
    description: 'Develop comprehensive analytics dashboard for time tracking data with custom reports',
    priority: 'High',
    estimatedHours: 32.00,
    actualHours: 28.75,
    status: 'completed',
    category: 'Development',
    tags: ['analytics', 'dashboard', 'internal'],
    completedAt: new Date('2025-01-08'),
    projectIndex: 0
  },
  {
    title: 'Design new user onboarding flow',
    description: 'Create intuitive onboarding experience for new VebTask users',
    priority: 'High',
    estimatedHours: 24.00,
    actualHours: 22.50,
    status: 'completed',
    category: 'Design',
    tags: ['onboarding', 'ux', 'design'],
    completedAt: new Date('2025-01-05'),
    projectIndex: 0
  },
  {
    title: 'Optimize database performance for large datasets',
    description: 'Improve query performance and add proper indexing for time tracking data',
    priority: 'High',
    estimatedHours: 20.00,
    actualHours: 18.25,
    status: 'in_progress',
    category: 'Development',
    tags: ['performance', 'database', 'optimization'],
    projectIndex: 0
  },
  {
    title: 'Implement real-time collaboration features',
    description: 'Add real-time updates and collaboration tools for team projects',
    priority: 'Medium',
    estimatedHours: 40.00,
    actualHours: 12.00,
    status: 'in_progress',
    category: 'Development',
    tags: ['realtime', 'collaboration', 'websockets'],
    projectIndex: 0
  },
  
  // Healthcare Dashboard Tasks
  {
    title: 'Medical data visualization components',
    description: 'Create specialized charts and graphs for healthcare metrics',
    priority: 'High',
    estimatedHours: 36.00,
    actualHours: 31.50,
    status: 'completed',
    category: 'Development',
    tags: ['healthcare', 'visualization', 'components'],
    completedAt: new Date('2024-12-20'),
    projectIndex: 1
  },
  {
    title: 'HIPAA compliance audit and implementation',
    description: 'Ensure all data handling meets HIPAA compliance requirements',
    priority: 'High',
    estimatedHours: 28.00,
    actualHours: 25.75,
    status: 'completed',
    category: 'Security',
    tags: ['hipaa', 'compliance', 'security'],
    completedAt: new Date('2024-12-15'),
    projectIndex: 1
  },
  {
    title: 'AI model integration for patient risk assessment',
    description: 'Integrate machine learning models for predictive healthcare analytics',
    priority: 'High',
    estimatedHours: 45.00,
    actualHours: 18.25,
    status: 'in_progress',
    category: 'AI/ML',
    tags: ['ai', 'machine-learning', 'healthcare'],
    projectIndex: 1
  },
  {
    title: 'Real-time patient monitoring dashboard',
    description: 'Build real-time dashboard for patient vital signs and alerts',
    priority: 'Medium',
    estimatedHours: 32.00,
    actualHours: 8.50,
    status: 'in_progress',
    category: 'Development',
    tags: ['realtime', 'monitoring', 'dashboard'],
    projectIndex: 1
  },

  // Energy Management Tasks
  {
    title: 'IoT sensor data collection system',
    description: 'Build scalable system for collecting and processing IoT sensor data',
    priority: 'High',
    estimatedHours: 38.00,
    actualHours: 35.25,
    status: 'completed',
    category: 'Development',
    tags: ['iot', 'sensors', 'data-collection'],
    completedAt: new Date('2024-12-30'),
    projectIndex: 2
  },
  {
    title: 'Energy efficiency optimization algorithms',
    description: 'Develop algorithms to optimize energy consumption based on usage patterns',
    priority: 'High',
    estimatedHours: 42.00,
    actualHours: 28.75,
    status: 'in_progress',
    category: 'AI/ML',
    tags: ['optimization', 'algorithms', 'energy'],
    projectIndex: 2
  },
  {
    title: 'Solar panel performance analytics',
    description: 'Create analytics system for monitoring solar panel efficiency and performance',
    priority: 'Medium',
    estimatedHours: 30.00,
    actualHours: 15.50,
    status: 'in_progress',
    category: 'Analytics',
    tags: ['solar', 'performance', 'analytics'],
    projectIndex: 2
  }
];

const VEBLEN_EXPENSES = [
  {
    title: 'AWS Cloud Infrastructure - Production',
    category: 'Cloud Services',
    description: 'Monthly AWS costs for production environments across all client projects',
    amount: 2847.92,
    vendor: 'Amazon Web Services',
    paymentMethod: 'card',
    expenseDate: new Date('2025-01-01'),
    status: 'approved',
    isTaxDeductible: true,
    isRecurring: true
  },
  {
    title: 'GitHub Enterprise License',
    category: 'Software',
    description: 'Annual GitHub Enterprise license for development team',
    amount: 1680.00,
    vendor: 'GitHub Inc.',
    paymentMethod: 'card',
    expenseDate: new Date('2025-01-01'),
    status: 'approved',
    isTaxDeductible: true,
    isRecurring: true
  },
  {
    title: 'Figma Professional Team Plan',
    category: 'Software',
    description: 'Monthly subscription for design team collaboration',
    amount: 144.00,
    vendor: 'Figma Inc.',
    paymentMethod: 'card',
    expenseDate: new Date('2025-01-01'),
    status: 'approved',
    isTaxDeductible: true,
    isRecurring: true
  },
  {
    title: 'Client Presentation Equipment',
    category: 'Equipment',
    description: 'Wireless presentation display and portable projector for client meetings',
    amount: 1249.99,
    vendor: 'Best Buy Business',
    paymentMethod: 'card',
    expenseDate: new Date('2025-01-03'),
    status: 'approved',
    isTaxDeductible: true,
    isRecurring: false
  },
  {
    title: 'Team Lunch - Project Milestone Celebration',
    category: 'Meals',
    description: 'Team celebration for completing healthcare dashboard milestone',
    amount: 287.65,
    vendor: 'The Innovation Grill',
    paymentMethod: 'card',
    expenseDate: new Date('2025-01-05'),
    status: 'approved',
    isTaxDeductible: true,
    isRecurring: false
  },
  {
    title: 'Professional Development - AI Conference',
    category: 'Training',
    description: 'Registration for AI/ML conference for development team',
    amount: 1850.00,
    vendor: 'AI Innovation Summit',
    paymentMethod: 'card',
    expenseDate: new Date('2025-01-07'),
    status: 'pending',
    isTaxDeductible: true,
    isRecurring: false
  }
];

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

async function createVeblenTimeLogsForUser(userId, orgId, tasks, isFounder = false) {
  const timeLogs = [];
  const now = new Date();
  
  // Founders and leads work more hours, regular staff work normal hours
  const baseHours = isFounder ? 8 : 6;
  const dayVariation = isFounder ? 3 : 2;
  const numEntries = isFounder ? 25 : 18;
  
  // Create time logs over the past month
  for (let i = 0; i < numEntries; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    // Skip weekends for most entries
    if (startDate.getDay() === 0 || startDate.getDay() === 6) {
      if (Math.random() > (isFounder ? 0.3 : 0.1)) continue;
    }
    
    startDate.setHours(8 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60), 0, 0);
    
    const workHours = baseHours + Math.floor(Math.random() * dayVariation);
    const duration = workHours * 3600 + Math.floor(Math.random() * 1800); // Add up to 30 min variation
    const endDate = new Date(startDate.getTime() + duration * 1000);
    
    const task = tasks[Math.floor(Math.random() * tasks.length)];
    const categories = isFounder ? 
      ['work', 'meeting', 'planning', 'strategy'] : 
      ['work', 'meeting', 'development', 'research'];
    
    const category = categories[Math.floor(Math.random() * categories.length)];
    const hourlyRate = isFounder ? 200.00 : 150.00;
    
    timeLogs.push({
      userId,
      orgId,
      taskId: task.id,
      begin: startDate,
      end: endDate,
      duration,
      category,
      description: `${category === 'meeting' ? 'Meeting about' : 'Working on'} ${task.title}`,
      isBillable: Math.random() > 0.2,
      hourlyRate,
      earnings: (duration / 3600) * hourlyRate
    });
  }
  
  // Create one active timer for some users
  if (Math.random() > 0.4) {
    const activeStart = new Date(now.getTime() - (1 + Math.random() * 3) * 60 * 60 * 1000);
    const activeTask = tasks[Math.floor(Math.random() * tasks.length)];
    
    timeLogs.push({
      userId,
      orgId,
      taskId: activeTask.id,
      begin: activeStart,
      end: null,
      duration: 0,
      category: 'work',
      description: `Currently working on ${activeTask.title}`,
      isBillable: true,
      hourlyRate: isFounder ? 200.00 : 150.00
    });
  }
  
  return timeLogs;
}

async function seedVeblenData() {
  console.log('🚀 Starting Veblen organization data seeding...');
  
  try {
    // Check if Veblen org already exists
    const existingOrg = await prisma.organization.findFirst({
      where: { slug: 'veblen' }
    });
    
    if (existingOrg) {
      console.log('🧹 Cleaning existing Veblen data...');
      await prisma.timeLog.deleteMany({ where: { orgId: existingOrg.id } });
      await prisma.calendarEvent.deleteMany({ where: { orgId: existingOrg.id } });
      await prisma.macroTask.deleteMany({ where: { orgId: existingOrg.id } });
      await prisma.brainDump.deleteMany({ where: { orgId: existingOrg.id } });
      await prisma.expense.deleteMany({ where: { orgId: existingOrg.id } });
      await prisma.project.deleteMany({ where: { orgId: existingOrg.id } });
      await prisma.client.deleteMany({ where: { orgId: existingOrg.id } });
      await prisma.membership.deleteMany({ where: { orgId: existingOrg.id } });
      await prisma.account.deleteMany({
        where: { user: { email: { endsWith: '@veblen.com' } } }
      });
      await prisma.session.deleteMany({
        where: { user: { email: { endsWith: '@veblen.com' } } }
      });
      await prisma.user.deleteMany({ where: { email: { endsWith: '@veblen.com' } } });
      await prisma.organization.delete({ where: { id: existingOrg.id } });
    }
    
    // Create Veblen organization with founder
    console.log('🏢 Creating Veblen organization...');
    const veblenOrg = await prisma.organization.create({
      data: {
        name: 'Veblen',
        slug: 'veblen',
        createdBy: {
          create: {
            email: VEBLEN_USERS[0].email,
            name: VEBLEN_USERS[0].name,
            emailVerified: true,
            accounts: {
              create: {
                type: 'credentials',
                provider: 'credentials',
                providerId: 'credentials',
                providerAccountId: VEBLEN_USERS[0].email,
                password: await hashPassword(VEBLEN_USERS[0].password)
              }
            }
          }
        }
      },
      include: { createdBy: true }
    });
    
    console.log('👥 Creating Veblen team members...');
    const users = [veblenOrg.createdBy];
    
    // Create remaining team members
    for (let i = 1; i < VEBLEN_USERS.length; i++) {
      const userData = VEBLEN_USERS[i];
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          name: userData.name,
          emailVerified: true,
          accounts: {
            create: {
              type: 'credentials',
              provider: 'credentials',
              providerId: 'credentials',
              providerAccountId: userData.email,
              password: await hashPassword(userData.password)
            }
          }
        }
      });
      users.push(user);
    }
    
    // Create memberships for all team members
    console.log('🤝 Creating team memberships...');
    for (let i = 0; i < users.length; i++) {
      await prisma.membership.create({
        data: {
          userId: users[i].id,
          orgId: veblenOrg.id,
          role: VEBLEN_USERS[i].role
        }
      });
    }
    
    // Create Veblen clients
    console.log('🏢 Creating Veblen clients...');
    const clients = [];
    for (const clientData of VEBLEN_CLIENTS) {
      const client = await prisma.client.create({
        data: {
          ...clientData,
          orgId: veblenOrg.id
        }
      });
      clients.push(client);
    }
    
    // Create Veblen projects
    console.log('📋 Creating Veblen projects...');
    const projects = [];
    for (let i = 0; i < VEBLEN_PROJECTS.length; i++) {
      const projectData = VEBLEN_PROJECTS[i];
      
      const project = await prisma.project.create({
        data: {
          name: projectData.name,
          description: projectData.description,
          status: projectData.status,
          priority: projectData.priority,
          budget: projectData.budget,
          spent: projectData.spent,
          progress: projectData.progress,
          estimatedHours: projectData.estimatedHours,
          hoursLogged: projectData.hoursLogged,
          startDate: projectData.startDate,
          endDate: projectData.endDate,
          color: projectData.color,
          orgId: veblenOrg.id,
          clientId: projectData.isInternal ? null : clients[i % clients.length].id
        }
      });
      projects.push(project);
    }
    
    // Create Veblen tasks
    console.log('✅ Creating Veblen tasks...');
    const tasks = [];
    for (let i = 0; i < VEBLEN_TASKS.length; i++) {
      const taskData = VEBLEN_TASKS[i];
      const assignedUser = users[1 + (i % (users.length - 1))]; // Skip founder, rotate through team
      const relatedProject = projects[taskData.projectIndex];
      
      const task = await prisma.macroTask.create({
        data: {
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority,
          estimatedHours: taskData.estimatedHours,
          actualHours: taskData.actualHours,
          status: taskData.status,
          category: taskData.category,
          tags: taskData.tags,
          completedAt: taskData.completedAt,
          userId: assignedUser.id,
          orgId: veblenOrg.id,
          createdBy: assignedUser.id
        }
      });
      tasks.push(task);
    }
    
    // Create time logs for all team members
    console.log('⏰ Creating Veblen time logs...');
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const isFounder = i === 0;
      const userTimeLogs = await createVeblenTimeLogsForUser(user.id, veblenOrg.id, tasks, isFounder);
      
      for (const timeLogData of userTimeLogs) {
        await prisma.timeLog.create({ data: timeLogData });
      }
    }
    
    // Create Veblen expenses
    console.log('💰 Creating Veblen expenses...');
    for (const expenseData of VEBLEN_EXPENSES) {
      await prisma.expense.create({
        data: {
          ...expenseData,
          orgId: veblenOrg.id,
          userId: users[1].id // Assign to Head of Operations
        }
      });
    }
    
    // Create calendar events
    console.log('📅 Creating Veblen calendar events...');
    const calendarEvents = [
      {
        title: 'Weekly Team Standup',
        description: 'Weekly team sync and project updates',
        startTime: new Date('2025-01-13T09:00:00Z'),
        endTime: new Date('2025-01-13T10:00:00Z'),
        type: 'meeting',
        color: '#8b5cf6',
        userId: users[0].id
      },
      {
        title: 'Client Presentation - Healthcare Dashboard',
        description: 'Demo latest features to MedTech Innovations team',
        startTime: new Date('2025-01-15T15:00:00Z'),
        endTime: new Date('2025-01-15T16:30:00Z'),
        type: 'meeting',
        color: '#3b82f6',
        userId: users[2].id
      },
      {
        title: 'Architecture Review - AI Integration',
        description: 'Technical architecture review for enterprise AI platform',
        startTime: new Date('2025-01-17T14:00:00Z'),
        endTime: new Date('2025-01-17T16:00:00Z'),
        type: 'meeting',
        color: '#10b981',
        userId: users[2].id
      },
      {
        title: 'Quarterly Business Review',
        description: 'Q4 review and Q1 planning session',
        startTime: new Date('2025-01-20T10:00:00Z'),
        endTime: new Date('2025-01-20T12:00:00Z'),
        type: 'meeting',
        color: '#f59e0b',
        userId: users[0].id
      }
    ];
    
    for (const eventData of calendarEvents) {
      await prisma.calendarEvent.create({
        data: {
          ...eventData,
          orgId: veblenOrg.id
        }
      });
    }
    
    // Create brain dumps
    console.log('🧠 Creating Veblen brain dumps...');
    const brainDumps = [
      {
        rawContent: `VebTask v2.0 Feature Ideas:
        - Advanced AI-powered time tracking suggestions
        - Predictive project timeline analysis
        - Integration with popular dev tools (GitHub, Jira, Slack)
        - Mobile app with offline capabilities
        - Advanced reporting and analytics dashboard
        - Client portal for project visibility
        - Team performance insights and recommendations
        - Automated billing tracking from time logs`,
        processedContent: {
          summary: 'VebTask v2.0 roadmap with AI features and integrations',
          actionItems: ['AI time tracking', 'Predictive analytics', 'Tool integrations', 'Mobile app']
        },
        processingStatus: 'completed',
        userId: users[0].id
      },
      {
        rawContent: `Healthcare Project Insights:
        - HIPAA compliance is crucial - all data must be encrypted
        - Real-time monitoring requires WebSocket implementation
        - AI model needs to be explainable for medical decisions
        - Integration with existing EMR systems is complex but necessary
        - User training will be critical for adoption
        - Performance must be optimized for large datasets
        - Mobile access needed for healthcare workers`,
        processedContent: {
          summary: 'Healthcare project technical and compliance considerations',
          actionItems: ['HIPAA compliance audit', 'WebSocket implementation', 'EMR integration', 'Performance optimization']
        },
        processingStatus: 'completed',
        userId: users[2].id
      },
      {
        rawContent: `Team Growth Strategy:
        - Need to hire 2 more senior developers by Q2
        - Consider opening satellite office in Austin
        - Invest in team training and certifications
        - Improve remote work infrastructure
        - Develop internal tool suite for better productivity
        - Create mentorship program for junior developers
        - Establish clear career progression paths`,
        processedContent: {
          summary: 'Team expansion and development strategy for 2025',
          actionItems: ['Hire senior developers', 'Austin office', 'Training programs', 'Mentorship program']
        },
        processingStatus: 'completed',
        userId: users[1].id
      }
    ];
    
    for (const brainDumpData of brainDumps) {
      await prisma.brainDump.create({
        data: {
          ...brainDumpData,
          orgId: veblenOrg.id
        }
      });
    }
    
    console.log('✅ Veblen organization data seeding completed successfully!');
    console.log('');
    console.log('🏢 Veblen Organization Created');
    console.log('📋 Veblen team accounts:');
    VEBLEN_USERS.forEach(user => {
      console.log(`  ${user.title}: ${user.email} / ${user.password}`);
    });
    console.log('');
    console.log(`📊 Created: ${clients.length} clients, ${projects.length} projects, ${tasks.length} tasks`);
    console.log(`👥 Team size: ${users.length} members`);
    
  } catch (error) {
    console.error('❌ Error seeding Veblen data:', error);
    throw error;
  }
}

async function main() {
  await seedVeblenData();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });