const { createPool } = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function setupVeblen() {
  const pool = createPool(process.env.DATABASE_URL);
  
  try {
    console.log('🚀 Setting up Veblen organization manually...');
    
    const userId = '53ebe8d8-4700-43b0-aae7-f30608cd3b66'; // Tony's existing user ID
    const orgId = 'veblen-org-' + Date.now(); // Generate a unique org ID
    const membershipId = 'membership-' + Date.now();
    const accountId = 'account-' + Date.now();
    
    // First, make sure user exists and update name
    await pool.execute('UPDATE User SET name = ?, completedWizards = ? WHERE id = ?', 
      ['Tony Opus', 'welcome,organization,profile,team', userId]);
    console.log('✅ User updated');
    
    // Create the organization manually
    await pool.execute(
      'INSERT IGNORE INTO organizations (id, name, slug, createdById, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(), NOW())', 
      [orgId, 'Veblen', 'veblen', userId]
    );
    console.log('✅ Organization created');
    
    // Create OWNER membership
    await pool.execute(
      'INSERT IGNORE INTO memberships (id, userId, orgId, role, createdAt, updatedAt) VALUES (?, ?, ?, ?, NOW(), NOW())', 
      [membershipId, userId, orgId, 'OWNER']
    );
    console.log('✅ Membership created');
    
    // Create email/password account for login
    const hashedPassword = await bcrypt.hash('VeblenAdmin2025!', 12);
    await pool.execute(
      'INSERT IGNORE INTO Account (id, accountId, userId, providerId, providerAccountId, type, password, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())', 
      [accountId, userId + '-email-password', userId, 'email-password', 'tony@opusautomations.com', 'credential', hashedPassword]
    );
    console.log('✅ Account created');
    
    // Verify setup
    const [orgs] = await pool.execute('SELECT * FROM organizations WHERE slug = ?', ['veblen']);
    const [memberships] = await pool.execute('SELECT * FROM memberships WHERE userId = ? AND orgId = ?', [userId, orgId]);
    
    console.log('🎉 Setup completed!');
    console.log('📋 Login Details:');
    console.log('   Email: tony@opusautomations.com');
    console.log('   Password: VeblenAdmin2025!');
    console.log('   Organization: Veblen (Owner)');
    console.log('   Org ID:', orgId);
    console.log('   Membership role:', memberships[0]?.role);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) console.error('Error code:', error.code);
  } finally {
    await pool.end();
  }
}

setupVeblen();