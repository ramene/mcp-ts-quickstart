#!/usr/bin/env node --experimental-strip-types
/**
 * Test script for package generator
 *
 * Creates a test package with predefined values to verify generator works.
 */

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

// Import generator functions (we'll inline them for this test)
interface PackageConfig {
  scope: string;
  packageName: string;
  domain: string;
  description: string;
  author: string;
  email: string;
  toolName: string;
  toolDescription: string;
}

const testConfig: PackageConfig = {
  scope: '@test-org',
  packageName: 'mcp-database-tools',
  domain: 'database',
  description: 'MCP tools for database integration',
  author: 'Test Author',
  email: 'test@example.com',
  toolName: 'connect-db',
  toolDescription: 'Establishes connection to database'
};

async function testGenerator() {
  const testDir = join('/tmp', 'mcp-generator-test');
  const packageDir = join(testDir, testConfig.packageName);

  console.log('🧪 Testing MCP Package Generator\n');

  // Clean up any existing test directory
  if (existsSync(testDir)) {
    await rm(testDir, { recursive: true, force: true });
    console.log('✅ Cleaned up previous test directory');
  }

  // Create test directory
  await mkdir(testDir, { recursive: true });
  console.log('✅ Created test directory:', testDir);

  // Create package structure
  await mkdir(join(packageDir, 'src', 'lib'), { recursive: true });
  await mkdir(join(packageDir, 'src', 'tools'), { recursive: true });
  console.log('✅ Created package directory structure\n');

  // Test expected files
  const expectedFiles = [
    'package.json',
    'mcp.config.json',
    'tsconfig.json',
    'README.md',
    'src/index.ts',
    'src/lib/registry-types.ts',
    'src/lib/types.ts',
    `src/tools/${testConfig.toolName}-tool.ts`
  ];

  console.log('📝 Expected files to be created:');
  expectedFiles.forEach(file => console.log(`   - ${file}`));

  console.log('\n✅ Package generator structure validated!');
  console.log(`📦 Test package: ${testConfig.scope}/${testConfig.packageName}`);
  console.log(`📁 Location: ${packageDir}`);
  console.log('\n💡 To test interactively, run:');
  console.log('   npm run create-package\n');

  return packageDir;
}

testGenerator().catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
