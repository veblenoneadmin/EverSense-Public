-- SQL script to fix Tony's organization membership
-- Run this against your production database

-- First, let's check if Tony's user exists
SELECT 'Tony User Check:' as step;
SELECT id, email, name, emailVerified, createdAt 
FROM user 
WHERE email = 'tony@opusautomations.com';

-- Check if Veblen organization exists
SELECT 'Veblen Organization Check:' as step;
SELECT id, name, slug, createdById, createdAt 
FROM organizations 
WHERE slug = 'veblen';

-- Check current memberships for Tony
SELECT 'Tony Current Memberships:' as step;
SELECT m.id, m.role, o.name as org_name, o.slug, m.createdAt
FROM memberships m 
JOIN organizations o ON m.orgId = o.id 
JOIN user u ON m.userId = u.id
WHERE u.email = 'tony@opusautomations.com';

-- If Veblen organization doesn't exist, create it
INSERT IGNORE INTO organizations (id, name, slug, createdById, createdAt, updatedAt)
SELECT 
    CONCAT('org_', UUID()) as id,
    'Veblen' as name,
    'veblen' as slug,
    u.id as createdById,
    NOW() as createdAt,
    NOW() as updatedAt
FROM user u 
WHERE u.email = 'tony@opusautomations.com' 
AND NOT EXISTS (SELECT 1 FROM organizations WHERE slug = 'veblen');

-- Create or update Tony's OWNER membership in Veblen organization
INSERT INTO memberships (id, userId, orgId, role, createdAt, updatedAt)
SELECT 
    CONCAT('mem_', UUID()) as id,
    u.id as userId,
    o.id as orgId,
    'OWNER' as role,
    NOW() as createdAt,
    NOW() as updatedAt
FROM user u
CROSS JOIN organizations o
WHERE u.email = 'tony@opusautomations.com' 
AND o.slug = 'veblen'
AND NOT EXISTS (
    SELECT 1 FROM memberships m2 
    WHERE m2.userId = u.id AND m2.orgId = o.id
)
ON DUPLICATE KEY UPDATE 
    role = 'OWNER',
    updatedAt = NOW();

-- Verify the fix
SELECT 'Final Verification:' as step;
SELECT 
    u.email,
    u.name,
    o.name as organization,
    o.slug,
    m.role,
    m.createdAt as membership_created
FROM user u
JOIN memberships m ON u.id = m.userId
JOIN organizations o ON m.orgId = o.id
WHERE u.email = 'tony@opusautomations.com';