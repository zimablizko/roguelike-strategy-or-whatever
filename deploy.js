import { execSync } from 'child_process';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Deploy script for GitHub Pages
 * This script builds the project and deploys it to the gh-pages branch
 */

// Read configuration from package.json
const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));
const repoName = packageJson.name;
const distDir = 'dist';
const repoUrl = `https://github.com/zimablizko/${repoName}.git`;

console.log('🚀 Starting GitHub Pages deployment...\n');

try {
  // Check if dist directory exists
  if (!existsSync(distDir)) {
    console.error('❌ Error: dist directory not found. Please run "npm run build" first.');
    process.exit(1);
  }

  console.log('📦 Dist directory found');

  // Navigate to dist directory
  process.chdir(distDir);

  // Create .nojekyll file to prevent Jekyll processing
  writeFileSync('.nojekyll', '');
  console.log('✅ Created .nojekyll file');

  // Initialize git repo in dist
  if (!existsSync('.git')) {
    execSync('git init', { stdio: 'inherit' });
    console.log('✅ Initialized git repository');
  }

  // Configure git
  execSync('git config user.name "GitHub Actions"', { stdio: 'inherit' });
  execSync('git config user.email "actions@github.com"', { stdio: 'inherit' });

  // Add all files
  execSync('git add -A', { stdio: 'inherit' });
  console.log('✅ Added files to git');

  // Commit
  const commitMessage = `Deploy to GitHub Pages - ${new Date().toISOString()}`;
  execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
  console.log('✅ Created commit');

  // Force push to gh-pages branch
  execSync(`git push -f ${repoUrl} HEAD:gh-pages`, { stdio: 'inherit' });
  console.log('✅ Pushed to gh-pages branch');

  console.log('\n🎉 Deployment successful!');
  console.log(`📍 Your site will be available at: https://zimablizko.github.io/${repoName}/`);
  console.log('⏳ Note: It may take a few minutes for GitHub Pages to update.');

} catch (error) {
  console.error('\n❌ Deployment failed:', error.message);
  process.exit(1);
}
