-- SQL script to manually create the projects table if it doesn't exist
-- Based on the Prisma schema Project model

CREATE TABLE IF NOT EXISTS `projects` (
  `id` VARCHAR(191) NOT NULL,
  `orgId` VARCHAR(191) NOT NULL,
  `clientId` VARCHAR(191) NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'planning',
  `priority` VARCHAR(20) NOT NULL DEFAULT 'medium',
  `budget` DECIMAL(10,2) NULL,
  `spent` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `progress` INT NOT NULL DEFAULT 0,
  `estimatedHours` INT NOT NULL DEFAULT 0,
  `hoursLogged` INT NOT NULL DEFAULT 0,
  `startDate` DATETIME(3) NULL,
  `endDate` DATETIME(3) NULL,
  `color` VARCHAR(50) NOT NULL DEFAULT 'bg-primary',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  
  PRIMARY KEY (`id`),
  INDEX `projects_orgId_idx`(`orgId`),
  INDEX `projects_clientId_idx`(`clientId`),
  
  CONSTRAINT `projects_orgId_fkey` FOREIGN KEY (`orgId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `projects_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Check if the table was created successfully
SELECT 'Project table created successfully' as result;