// Demo script to create sample projects and tasks for testing the report modal
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedProjectTaskDemo() {
  try {
    console.log('🌱 Seeding demo projects and tasks...');

    // Get the first organization to use for demo data
    const org = await prisma.organization.findFirst();
    if (!org) {
      console.log('❌ No organization found. Please create an organization first.');
      return;
    }

    // Get the first user to assign tasks
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('❌ No user found. Please create a user first.');
      return;
    }

    console.log(`📊 Using org: ${org.name} (${org.id})`);
    console.log(`👤 Using user: ${user.name || user.email} (${user.id})`);

    // Create sample projects
    const projects = await Promise.all([
      prisma.project.create({
        data: {
          name: 'E-commerce Website',
          description: 'Building a modern e-commerce platform with React and Node.js',
          status: 'active',
          priority: 'high',
          color: '#646cff',
          budget: 50000,
          spent: 12500,
          progress: 35,
          estimatedHours: 200,
          hoursLogged: 70,
          orgId: org.id,
          clientName: 'TechCorp Solutions'
        }
      }),
      prisma.project.create({
        data: {
          name: 'Mobile App MVP',
          description: 'Developing a minimum viable product for mobile app',
          status: 'planning',
          priority: 'medium',
          color: '#10b981',
          budget: 25000,
          spent: 5000,
          progress: 15,
          estimatedHours: 120,
          hoursLogged: 18,
          orgId: org.id,
          clientName: 'StartupXYZ'
        }
      }),
      prisma.project.create({
        data: {
          name: 'Data Analytics Dashboard',
          description: 'Creating a comprehensive analytics dashboard for business intelligence',
          status: 'active',
          priority: 'high',
          color: '#f59e0b',
          budget: 75000,
          spent: 30000,
          progress: 60,
          estimatedHours: 300,
          hoursLogged: 180,
          orgId: org.id,
          clientName: 'DataDriven LLC'
        }
      })
    ]);

    console.log(`✅ Created ${projects.length} sample projects`);

    // Create sample tasks for each project
    const taskPromises = [];

    // Tasks for E-commerce Website
    taskPromises.push(
      prisma.macroTask.create({
        data: {
          title: 'Design user interface mockups',
          description: 'Create wireframes and high-fidelity mockups for the main pages',
          userId: user.id,
          orgId: org.id,
          projectId: projects[0].id,
          createdBy: user.id,
          priority: 'High',
          estimatedHours: 16,
          actualHours: 12,
          status: 'completed',
          category: 'Design'
        }
      }),
      prisma.macroTask.create({
        data: {
          title: 'Implement product catalog',
          description: 'Build the product listing and detail pages with search functionality',
          userId: user.id,
          orgId: org.id,
          projectId: projects[0].id,
          createdBy: user.id,
          priority: 'High',
          estimatedHours: 24,
          actualHours: 18,
          status: 'in_progress',
          category: 'Development'
        }
      }),
      prisma.macroTask.create({
        data: {
          title: 'Setup payment integration',
          description: 'Integrate Stripe payment processing for checkout',
          userId: user.id,
          orgId: org.id,
          projectId: projects[0].id,
          createdBy: user.id,
          priority: 'Medium',
          estimatedHours: 12,
          status: 'not_started',
          category: 'Integration'
        }
      })
    );

    // Tasks for Mobile App MVP
    taskPromises.push(
      prisma.macroTask.create({
        data: {
          title: 'Create app architecture',
          description: 'Design the overall architecture and tech stack for the mobile app',
          userId: user.id,
          orgId: org.id,
          projectId: projects[1].id,
          createdBy: user.id,
          priority: 'High',
          estimatedHours: 8,
          actualHours: 6,
          status: 'completed',
          category: 'Planning'
        }
      }),
      prisma.macroTask.create({
        data: {
          title: 'Develop authentication system',
          description: 'Implement user registration, login, and password reset functionality',
          userId: user.id,
          orgId: org.id,
          projectId: projects[1].id,
          createdBy: user.id,
          priority: 'High',
          estimatedHours: 16,
          actualHours: 8,
          status: 'in_progress',
          category: 'Development'
        }
      })
    );

    // Tasks for Analytics Dashboard
    taskPromises.push(
      prisma.macroTask.create({
        data: {
          title: 'Build data visualization components',
          description: 'Create reusable chart components using Chart.js or D3.js',
          userId: user.id,
          orgId: org.id,
          projectId: projects[2].id,
          createdBy: user.id,
          priority: 'High',
          estimatedHours: 32,
          actualHours: 28,
          status: 'completed',
          category: 'Development'
        }
      }),
      prisma.macroTask.create({
        data: {
          title: 'Implement real-time data sync',
          description: 'Setup WebSocket connections for live data updates',
          userId: user.id,
          orgId: org.id,
          projectId: projects[2].id,
          createdBy: user.id,
          priority: 'Medium',
          estimatedHours: 20,
          actualHours: 15,
          status: 'in_progress',
          category: 'Backend'
        }
      }),
      prisma.macroTask.create({
        data: {
          title: 'Create admin panel',
          description: 'Build administrative interface for managing dashboard settings',
          userId: user.id,
          orgId: org.id,
          projectId: projects[2].id,
          createdBy: user.id,
          priority: 'Low',
          estimatedHours: 16,
          status: 'not_started',
          category: 'Development'
        }
      })
    );

    const tasks = await Promise.all(taskPromises);
    console.log(`✅ Created ${tasks.length} sample tasks linked to projects`);

    console.log('\n🎉 Demo data created successfully!');
    console.log('\nSample data includes:');
    projects.forEach((project, index) => {
      const projectTasks = tasks.filter(task => task.projectId === project.id);
      console.log(`  📁 ${project.name} (${projectTasks.length} tasks)`);
    });

    console.log('\n✨ You can now test the Project Report modal with real project-task relationships!');

  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedProjectTaskDemo();