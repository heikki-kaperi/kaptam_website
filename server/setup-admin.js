#!/usr/bin/env node
/**
 * Admin Setup Script
 * Generates hashed password and JWT secret for admin authentication
 * Run this on your server after deploying
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const auth = require('./auth');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ENV_PATH = path.join(__dirname, '.env');

console.log('==========================================');
console.log('Kaptam Admin Setup');
console.log('==========================================');
console.log('This script will help you set up admin credentials.\n');

// Check if .env exists
if (!fs.existsSync(ENV_PATH)) {
  console.log('⚠️  .env file not found!');
  console.log('Creating .env from .env.example...\n');

  const examplePath = path.join(__dirname, '.env.example');
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, ENV_PATH);
    console.log('✅ Created .env file\n');
  } else {
    console.error('❌ .env.example not found! Please create a .env file manually.');
    process.exit(1);
  }
}

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function updateEnvFile(key, value) {
  try {
    let envContent = fs.readFileSync(ENV_PATH, 'utf8');

    // Check if key exists
    const regex = new RegExp(`^${key}=.*$`, 'm');

    if (regex.test(envContent)) {
      // Update existing key
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      // Add new key at the end of admin section or end of file
      const adminSectionRegex = /# Admin Dashboard Authentication/;
      if (adminSectionRegex.test(envContent)) {
        // Add after admin section header
        envContent = envContent.replace(
          adminSectionRegex,
          `# Admin Dashboard Authentication\n${key}=${value}`
        );
      } else {
        // Add at end
        envContent += `\n${key}=${value}`;
      }
    }

    fs.writeFileSync(ENV_PATH, envContent, 'utf8');
    return true;
  } catch (error) {
    console.error('Error updating .env file:', error);
    return false;
  }
}

async function main() {
  try {
    // Get username
    const username = await question('Admin username (default: admin): ');
    const adminUsername = username.trim() || 'admin';

    // Get password
    const password = await question('Admin password (min 8 characters): ');

    if (!password || password.length < 8) {
      console.error('\n❌ Password must be at least 8 characters long!');
      process.exit(1);
    }

    // Confirm password
    const confirmPassword = await question('Confirm password: ');

    if (password !== confirmPassword) {
      console.error('\n❌ Passwords do not match!');
      process.exit(1);
    }

    console.log('\n⏳ Generating secure credentials...\n');

    // Hash password
    const passwordHash = await auth.hashPassword(password);

    // Generate JWT secret
    const jwtSecret = auth.generateJWTSecret();

    // Update .env file
    console.log('📝 Updating .env file...\n');

    updateEnvFile('ADMIN_USERNAME', adminUsername);
    updateEnvFile('ADMIN_PASSWORD_HASH', passwordHash);
    updateEnvFile('JWT_SECRET', jwtSecret);

    console.log('==========================================');
    console.log('✅ Admin credentials set up successfully!');
    console.log('==========================================');
    console.log(`Username: ${adminUsername}`);
    console.log('Password: ********** (saved securely)');
    console.log('JWT Secret: Generated and saved');
    console.log('==========================================');
    console.log('\n⚠️  IMPORTANT:');
    console.log('- Keep your .env file secure');
    console.log('- Never commit .env to version control');
    console.log('- The password is hashed and cannot be recovered');
    console.log('- Run this script again to change credentials\n');
    console.log('You can now start the server with: npm start');
    console.log('==========================================\n');

  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
