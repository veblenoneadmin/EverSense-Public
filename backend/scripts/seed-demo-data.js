import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_USERS = [
  {
    email: 'admin@demo.com',
    name: 'Demo Admin',
    role: 'ADMIN',
    password: 'demo123'
  },
  {
    email: 'manager@demo.com',
    name: 'Sarah Johnson',
    role: 'STAFF', 
    password: 'demo123'
  },
  {
    email: 'developer@demo.com',
    name: 'Alex Chen',
    role: 'STAFF',
    password: 'demo123'
  },
  {
    email: 'client@demo.com',
    name: 'John Smith',
    role: 'CLIENT',
    password: 'demo123'
  }
];

const DEMO_CLIENTS = [
  {
    name: 'TechCorp Inc',
    email: 'contact@techcorp.com',
    company: 'TechCorp Inc',
    phone: '+1-555-0101',
    contactPerson: 'Michael Brown',
    industry: 'Technology',
    hourlyRate: 125.00,
    priority: 'high',
    status: 'active'
  },
  {
    name: 'GreenLeaf Solutions',
    email: 'info@greenleaf.com',
    company: 'GreenLeaf Solutions',
    phone: '+1-555-0102',
    contactPerson: 'Emily Davis',
    industry: 'Environmental',
    hourlyRate: 95.00,
    priority: 'medium',
    status: 'active'
  },
  {
    name: 'Retail Plus',
    email: 'hello@retailplus.com',
    company: 'Retail Plus',
    phone: '+1-555-0103',
    contactPerson: 'David Wilson',
    industry: 'Retail',
    hourlyRate: 85.00,
    priority: 'medium',
    status: 'potential'
  }
];

const DEMO_PROJECTS = [
  {
    name: 'E-commerce Platform Redesign',
    description: 'Complete overhaul of the existing e-commerce platform with modern UI/UX and improved performance',
    status: 'active',
    priority: 'high',
    budget: 50000.00,
    spent: 12500.00,
    progress: 25,
    estimatedHours: 400,
    hoursLogged: 95,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-04-30'),
    color: 'bg-blue-500'
  },
  {
    name: 'Mobile App Development',
    description: 'Development of iOS and Android mobile applications for customer engagement',
    status: 'active',
    priority: 'high',
    budget: 75000.00,
    spent: 8750.00,
    progress: 15,
    estimatedHours: 600,
    hoursLogged: 67,
    startDate: new Date('2025-01-15'),
    endDate: new Date('2025-06-15'),
    color: 'bg-green-500'
  },
  {
    name: 'Brand Identity Package',
    description: 'Complete brand identity design including logo, guidelines, and marketing materials',
    status: 'planning',
    priority: 'medium',
    budget: 15000.00,
    spent: 0.00,
    progress: 0,
    estimatedHours: 120,
    hoursLogged: 0,
    startDate: new Date('2025-02-01'),
    endDate: new Date('2025-03-15'),
    color: 'bg-purple-500'
  }
];

const DEMO_TASKS = [
  {
    title: 'Setup project architecture and development environment',
    description: 'Initialize the project structure, configure development tools, and set up CI/CD pipeline',
    priority: 'High',
    estimatedHours: 16.00,
    actualHours: 18.50,
    status: 'completed',
    category: 'Development',
    tags: ['setup', 'architecture', 'devops'],
    completedAt: new Date('2025-01-05')
  },
  {
    title: 'Design user interface mockups',
    description: 'Create detailed UI mockups for all main application screens and user flows',
    priority: 'High',
    estimatedHours: 24.00,
    actualHours: 22.75,
    status: 'completed',
    category: 'Design',
    tags: ['ui', 'design', 'mockups'],
    completedAt: new Date('2025-01-12')
  },
  {
    title: 'Implement authentication system',
    description: 'Build secure user authentication with login, registration, and password recovery',
    priority: 'High',
    estimatedHours: 20.00,
    actualHours: 15.25,
    status: 'in_progress',
    category: 'Development',
    tags: ['auth', 'security', 'backend']
  },
  {
    title: 'Develop product catalog functionality',
    description: 'Create product listing, filtering, search, and detail view components',
    priority: 'Medium',
    estimatedHours: 32.00,
    actualHours: 8.50,
    status: 'in_progress',
    category: 'Development',
    tags: ['frontend', 'catalog', 'products']
  },
  {
    title: 'Mobile app wireframing',
    description: 'Create wireframes and user flow diagrams for mobile application',
    priority: 'High',
    estimatedHours: 16.00,
    actualHours: 12.00,
    status: 'completed',
    category: 'Design',
    tags: ['mobile', 'wireframes', 'ux'],
    completedAt: new Date('2025-01-20')
  },
  {
    title: 'API development for mobile backend',
    description: 'Develop REST API endpoints for mobile app integration',
    priority: 'High',
    estimatedHours: 28.00,
    actualHours: 14.75,
    status: 'in_progress',
    category: 'Development',
    tags: ['api', 'backend', 'mobile']
  }
];

const DEMO_EXPENSES = [
  {
    title: 'Adobe Creative Cloud Subscription',
    category: 'Software',
    description: 'Monthly subscription for design tools',
    amount: 52.99,
    vendor: 'Adobe Systems',
    paymentMethod: 'card',
    expenseDate: new Date('2025-01-01'),
    status: 'approved',
    isTaxDeductible: true,
    isRecurring: true
  },
  {
    title: 'Office Supplies - Notebooks and Pens',
    category: 'Office Supplies',
    description: 'Stationery for project planning and notes',
    amount: 45.80,
    vendor: 'Staples',
    paymentMethod: 'card',
    expenseDate: new Date('2025-01-03'),
    status: 'approved',
    isTaxDeductible: true,
    isRecurring: false
  },
  {
    title: 'Client Meeting Lunch',
    category: 'Meals',
    description: 'Lunch meeting with TechCorp client',
    amount: 89.45,
    vendor: 'The Business Bistro',
    paymentMethod: 'cash',
    expenseDate: new Date('2025-01-08'),
    status: 'approved',
    isTaxDeductible: true,
    isRecurring: false
  }
];

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

async function createTimeLogsForUser(userId, orgId, tasks) {
  const timeLogs = [];
  const now = new Date();
  
  // Create some completed time logs over the past month
  for (let i = 0; i < 15; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    startDate.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);
    
    const duration = Math.floor(Math.random() * 4 + 1) * 3600; // 1-4 hours in seconds
    const endDate = new Date(startDate.getTime() + duration * 1000);
    
    const task = tasks[Math.floor(Math.random() * tasks.length)];
    
    timeLogs.push({
      userId,
      orgId,
      taskId: task.id,
      begin: startDate,
      end: endDate,
      duration,
      category: ['work', 'meeting', 'research'][Math.floor(Math.random() * 3)],
      description: `Working on ${task.title}`,
      isBillable: Math.random() > 0.3,
      hourlyRate: 95.00,
      earnings: (duration / 3600) * 95.00
    });
  }
  
  // Create one active timer (no end time)
  const activeStart = new Date(now.getTime() - 2 * 60 * 60 * 1000); // Started 2 hours ago
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
    hourlyRate: 95.00
  });
  
  return timeLogs;
}

async function seedDemoData() {
  console.log('🌱 Starting demo data seeding...');
  
  try {
    // Clean existing demo data (careful with this in production!)
    console.log('🧹 Cleaning existing demo data...');
    await prisma.timeLog.deleteMany();
    await prisma.calendarEvent.deleteMany();
    await prisma.macroTask.deleteMany();
    await prisma.brainDump.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.project.deleteMany();
    await prisma.client.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.account.deleteMany();
    await prisma.session.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany({ where: { email: { endsWith: '@demo.com' } } });
    
    // Create demo organization
    console.log('🏢 Creating demo organization...');
    const demoOrg = await prisma.organization.create({
      data: {
        name: 'Demo Agency',
        slug: 'demo-agency',
        createdBy: {
          create: {
            email: DEMO_USERS[0].email,
            name: DEMO_USERS[0].name,
            emailVerified: true,
            accounts: {
              create: {
                type: 'credentials',
                provider: 'credentials',
                providerId: 'credentials',
                providerAccountId: DEMO_USERS[0].email,
                password: await hashPassword(DEMO_USERS[0].password)
              }
            }
          }
        }
      },
      include: { createdBy: true }
    });
    
    console.log('👥 Creating demo users...');
    const users = [demoOrg.createdBy];
    
    // Create remaining users
    for (let i = 1; i < DEMO_USERS.length; i++) {
      const userData = DEMO_USERS[i];
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
    
    // Create memberships
    console.log('🤝 Creating memberships...');
    for (let i = 0; i < users.length; i++) {
      await prisma.membership.create({
        data: {
          userId: users[i].id,
          orgId: demoOrg.id,
          role: DEMO_USERS[i].role
        }
      });
    }
    
    // Create demo clients
    console.log('👔 Creating demo clients...');
    const clients = [];
    for (const clientData of DEMO_CLIENTS) {
      const client = await prisma.client.create({
        data: {
          ...clientData,
          orgId: demoOrg.id
        }
      });
      clients.push(client);
    }
    
    // Create demo projects
    console.log('📋 Creating demo projects...');
    const projects = [];
    for (let i = 0; i < DEMO_PROJECTS.length; i++) {
      const projectData = DEMO_PROJECTS[i];
      const client = clients[i % clients.length];
      
      const project = await prisma.project.create({
        data: {
          ...projectData,
          orgId: demoOrg.id,
          clientId: client.id
        }
      });
      projects.push(project);
    }
    
    // Create demo tasks
    console.log('✅ Creating demo tasks...');
    const tasks = [];
    for (let i = 0; i < DEMO_TASKS.length; i++) {
      const taskData = DEMO_TASKS[i];
      const user = users[1 + (i % (users.length - 1))]; // Skip admin, rotate through others
      
      const task = await prisma.macroTask.create({
        data: {
          ...taskData,
          userId: user.id,
          orgId: demoOrg.id,
          createdBy: user.id,
          tags: taskData.tags
        }
      });
      tasks.push(task);
    }
    
    // Create demo time logs
    console.log('⏰ Creating demo time logs...');
    for (const user of users.slice(1)) { // Skip admin user
      const userTimeLogs = await createTimeLogsForUser(user.id, demoOrg.id, tasks);
      for (const timeLogData of userTimeLogs) {
        await prisma.timeLog.create({ data: timeLogData });
      }
    }
    
    // Create demo expenses
    console.log('💰 Creating demo expenses...');
    for (const expenseData of DEMO_EXPENSES) {
      await prisma.expense.create({
        data: {
          ...expenseData,
          orgId: demoOrg.id,
          userId: users[1].id // Assign to manager
        }
      });
    }
    
    // Create some calendar events
    console.log('📅 Creating demo calendar events...');
    const calendarEvents = [
      {
        title: 'Client Kickoff Meeting - TechCorp',
        description: 'Initial project kickoff and requirements gathering',
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T11:30:00Z'),
        type: 'meeting',
        color: '#3b82f6'
      },
      {
        title: 'Design Review Session',
        description: 'Review UI mockups and gather feedback',
        startTime: new Date('2025-01-18T14:00:00Z'),
        endTime: new Date('2025-01-18T16:00:00Z'),
        type: 'meeting',
        color: '#10b981'
      },
      {
        title: 'Development Sprint Planning',
        description: 'Plan next development sprint and assign tasks',
        startTime: new Date('2025-01-22T09:00:00Z'),
        endTime: new Date('2025-01-22T10:30:00Z'),
        type: 'meeting',
        color: '#f59e0b'
      }
    ];
    
    for (const eventData of calendarEvents) {
      await prisma.calendarEvent.create({
        data: {
          ...eventData,
          userId: users[1].id,
          orgId: demoOrg.id
        }
      });
    }
    
    // Create some brain dumps
    console.log('🧠 Creating demo brain dumps...');
    const brainDumps = [
      {
        rawContent: `Project Ideas for Q1:
        - Implement real-time collaboration features
        - Add advanced analytics dashboard
        - Mobile app push notifications
        - Integration with popular project management tools
        - Custom reporting system for clients`,
        processedContent: {
          summary: 'Q1 project planning with focus on collaboration and analytics',
          actionItems: ['Real-time collaboration', 'Analytics dashboard', 'Push notifications']
        },
        processingStatus: 'completed'
      },
      {
        rawContent: `Client feedback from TechCorp meeting:
        - They love the new design direction
        - Need mobile app to support offline mode
        - Want integration with their existing CRM
        - Timeline is tight but doable
        - Budget approved for additional features`,
        processedContent: {
          summary: 'Positive client feedback with additional requirements',
          actionItems: ['Offline mode', 'CRM integration', 'Timeline planning']
        },
        processingStatus: 'completed'
      }
    ];
    
    for (const brainDumpData of brainDumps) {
      await prisma.brainDump.create({
        data: {
          ...brainDumpData,
          userId: users[1].id,
          orgId: demoOrg.id
        }
      });
    }
    
    console.log('✅ Demo data seeding completed successfully!');
    console.log('');
    console.log('📋 Demo accounts created:');
    console.log('  Admin: admin@demo.com / demo123');
    console.log('  Manager: manager@demo.com / demo123');
    console.log('  Developer: developer@demo.com / demo123');
    console.log('  Client: client@demo.com / demo123');
    console.log('');
    console.log('🏢 Organization: Demo Agency');
    console.log(`📊 Created: ${clients.length} clients, ${projects.length} projects, ${tasks.length} tasks`);
    
  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    throw error;
  }
}

async function main() {
  await seedDemoData();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });