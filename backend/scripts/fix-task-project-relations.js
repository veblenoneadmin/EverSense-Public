// Script to fix existing tasks to have proper project relations
// This addresses the issue where tasks were storing project names in category field
// but not setting the projectId foreign key

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixTaskProjectRelations() {
  console.log('🔧 Starting task-project relation fix...');

  try {
    // Get all tasks that have a project category but no projectId
    const tasksToFix = await prisma.macroTask.findMany({
      where: {
        OR: [
          {
            category: {
              startsWith: 'Project:'
            },
            projectId: null
          },
          {
            category: {
              startsWith: 'Project:'
            },
            projectId: undefined
          }
        ]
      },
      select: {
        id: true,
        category: true,
        projectId: true
      }
    });

    console.log(`📊 Found ${tasksToFix.length} tasks that need project relation fixes`);

    // Get all projects for matching
    const projects = await prisma.project.findMany({
      select: {
        id: true,
        name: true
      }
    });

    console.log(`📊 Found ${projects.length} projects for matching`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const task of tasksToFix) {
      // Extract project name from category (e.g., "Project: My Project Name" -> "My Project Name")
      const projectName = task.category.replace('Project: ', '').trim();

      // Find matching project
      const matchingProject = projects.find(p => p.name === projectName);

      if (matchingProject) {
        try {
          await prisma.macroTask.update({
            where: { id: task.id },
            data: { projectId: matchingProject.id }
          });
          console.log(`✅ Fixed task ${task.id} -> linked to project "${matchingProject.name}" (${matchingProject.id})`);
          fixedCount++;
        } catch (error) {
          console.error(`❌ Failed to fix task ${task.id}:`, error.message);
          skippedCount++;
        }
      } else {
        console.log(`⚠️  Skipping task ${task.id} - no matching project found for "${projectName}"`);
        skippedCount++;
      }
    }

    console.log('\n📊 Fix Summary:');
    console.log(`✅ Fixed: ${fixedCount} tasks`);
    console.log(`⚠️  Skipped: ${skippedCount} tasks`);
    console.log(`🔧 Total processed: ${tasksToFix.length} tasks`);

  } catch (error) {
    console.error('❌ Error during task-project relation fix:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixTaskProjectRelations()
  .then(() => {
    console.log('✅ Task-project relation fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Task-project relation fix failed:', error);
    process.exit(1);
  });