#!/usr/bin/env node --experimental-strip-types
/**
 * MCP Package Generator
 *
 * Interactive CLI tool to scaffold new MCP tool packages with proper structure,
 * configuration, and example tool implementation.
 *
 * Usage: node --experimental-strip-types bin/create-mcp-package.ts
 */

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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

const rl = createInterface({ input, output });

async function prompt(question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` (${defaultValue})` : '';
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || defaultValue || '';
}

async function collectPackageInfo(): Promise<PackageConfig> {
  console.log('\n📦 MCP Package Generator\n');
  console.log('This tool will create a new MCP tool package with proper structure.\n');

  const scope = await prompt('Package scope (e.g., @your-org)', '@my-org');
  const domain = await prompt('Domain (e.g., github, slack, notion)', 'example');
  const packageName = `mcp-${domain}-tools`;
  const description = await prompt('Package description', `MCP tools for ${domain} integration`);
  const author = await prompt('Author name', 'Your Name');
  const email = await prompt('Author email', 'you@example.com');

  console.log('\n🔧 First Tool Configuration\n');
  const toolName = await prompt('First tool name (kebab-case)', 'hello-world');
  const toolDescription = await prompt('Tool description', 'A sample tool that demonstrates the pattern');

  return {
    scope,
    packageName,
    domain,
    description,
    author,
    email,
    toolName,
    toolDescription
  };
}

function generatePackageJson(config: PackageConfig): string {
  const fullPackageName = `${config.scope}/${config.packageName}`;

  return JSON.stringify({
    name: fullPackageName,
    version: '1.0.0',
    description: config.description,
    type: 'module',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    files: [
      'dist',
      'mcp.config.json',
      'README.md'
    ],
    scripts: {
      build: 'tsc',
      dev: 'tsc --watch',
      prepublishOnly: 'npm run build'
    },
    keywords: [
      'mcp',
      'mcp-tools',
      config.domain,
      'tools'
    ],
    author: `${config.author} <${config.email}>`,
    license: 'MIT',
    peerDependencies: {
      '@modelcontextprotocol/sdk': '^1.22.0'
    },
    dependencies: {
      zod: '^3.23.8'
    },
    devDependencies: {
      '@modelcontextprotocol/sdk': '^1.22.0',
      '@types/node': '^22.10.2',
      typescript: '^5.7.0'
    }
  }, null, 2);
}

function generateMcpConfig(config: PackageConfig): string {
  const fullPackageName = `${config.scope}/${config.packageName}`;

  return JSON.stringify({
    type: 'mcp-tools',
    name: fullPackageName,
    version: '1.0.0',
    toolsDir: 'dist/tools',
    domain: config.domain,
    requirements: {
      env: [],
      sdk: '^1.22.0'
    },
    tools: [
      config.toolName
    ],
    metadata: {
      author: config.author,
      homepage: `https://github.com/${config.author.toLowerCase().replace(/\s+/g, '-')}/${config.packageName}`,
      documentation: `https://github.com/${config.author.toLowerCase().replace(/\s+/g, '-')}/${config.packageName}/blob/main/README.md`
    }
  }, null, 2);
}

function generateTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ES2022',
      lib: ['ES2022'],
      moduleResolution: 'bundler',
      rootDir: './src',
      outDir: './dist',
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      allowSyntheticDefaultImports: true
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist']
  }, null, 2);
}

function generateRegistryTypes(): string {
  return `/**
 * Registry Types
 *
 * Type definitions for the MCP module registration system.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export type ModuleType = 'tool' | 'resource' | 'prompt';

export interface RegisterableModule {
  type: ModuleType;
  name: string;
  description: string;
  metadata?: {
    version?: string;
    tags?: string[];
    [key: string]: any;
  };
  register(server: McpServer): void;
}
`;
}

function generateIndexFile(config: PackageConfig): string {
  const camelCase = config.toolName.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

  return `// Export all tools for potential direct use
export { default as ${camelCase} } from './tools/${config.toolName}-tool.js';

// Export types if any
export * from './lib/types.js';
`;
}

function generateTypesFile(config: PackageConfig): string {
  return `/**
 * ${config.domain.charAt(0).toUpperCase() + config.domain.slice(1)} Types
 *
 * Domain-specific type definitions for ${config.domain} tools.
 */

// Add your domain-specific types here
export interface ${config.domain.charAt(0).toUpperCase() + config.domain.slice(1)}Config {
  // Configuration properties
}
`;
}

function generateToolFile(config: PackageConfig): string {
  return `/**
 * ${config.toolName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Tool
 *
 * ${config.toolDescription}
 */

import { z } from 'zod';
import type { RegisterableModule } from '../lib/registry-types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Tool implementation
 */
async function ${config.toolName.replace(/-/g, '_')}Handler(params: { message?: string }): Promise<string> {
  const message = params.message || 'Hello from ${config.toolName}!';
  return \`✅ \${message}\`;
}

/**
 * Registerable module
 */
const ${config.toolName.replace(/-/g, '_')}Module: RegisterableModule = {
  type: 'tool',
  name: '${config.toolName}',
  description: '${config.toolDescription}',

  metadata: {
    version: '1.0.0',
    tags: ['${config.domain}', 'example']
  },

  register(server: McpServer) {
    server.tool(
      this.name,
      this.description,
      {
        message: z.string().optional().describe('Optional message parameter')
      },
      async ({ message }) => {
        try {
          const result = await ${config.toolName.replace(/-/g, '_')}Handler({ message });

          return {
            content: [{
              type: 'text',
              text: result
            }]
          };

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          return {
            content: [{
              type: 'text',
              text: \`❌ Error in ${config.toolName}:\\n\\n\${errorMessage}\`
            }],
            isError: true
          };
        }
      }
    );
  }
};

export default ${config.toolName.replace(/-/g, '_')}Module;
`;
}

function generateReadme(config: PackageConfig): string {
  const fullPackageName = `${config.scope}/${config.packageName}`;

  return `# ${fullPackageName}

${config.description}

## Installation

\`\`\`bash
pnpm add ${fullPackageName}
\`\`\`

## Usage

### With Package Auto-Loader

\`\`\`typescript
import { autoLoadFromPackages } from './registry/package-loader.ts';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const server = new McpServer({
  name: 'my-mcp-server',
  version: '1.0.0'
});

await autoLoadFromPackages(server, {
  scope: '${config.scope}',
  enabledPackages: ['${config.packageName}'],
  verbose: true
});
\`\`\`

### Direct Import

\`\`\`typescript
import { ${config.toolName.replace(/-([a-z])/g, (g) => g[1].toUpperCase())} } from '${fullPackageName}';

// Register tool with MCP server
${config.toolName.replace(/-([a-z])/g, (g) => g[1].toUpperCase())}.register(server);
\`\`\`

## Tools

### ${config.toolName}

${config.toolDescription}

**Parameters:**
- \`message\` (optional): Optional message parameter

**Example:**
\`\`\`typescript
const result = await client.callTool({
  name: '${config.toolName}',
  arguments: {
    message: 'Hello, World!'
  }
});
\`\`\`

## Development

### Build

\`\`\`bash
pnpm build
\`\`\`

### Watch Mode

\`\`\`bash
pnpm dev
\`\`\`

## License

MIT © ${config.author}
`;
}

async function createPackage(config: PackageConfig, outputDir: string) {
  const packageDir = join(outputDir, config.packageName);

  console.log(`\n📁 Creating package at: ${packageDir}\n`);

  // Create directory structure
  await mkdir(join(packageDir, 'src', 'lib'), { recursive: true });
  await mkdir(join(packageDir, 'src', 'tools'), { recursive: true });

  // Generate files
  const files = [
    { path: 'package.json', content: generatePackageJson(config) },
    { path: 'mcp.config.json', content: generateMcpConfig(config) },
    { path: 'tsconfig.json', content: generateTsConfig() },
    { path: 'src/index.ts', content: generateIndexFile(config) },
    { path: 'src/lib/registry-types.ts', content: generateRegistryTypes() },
    { path: 'src/lib/types.ts', content: generateTypesFile(config) },
    { path: `src/tools/${config.toolName}-tool.ts`, content: generateToolFile(config) },
    { path: 'README.md', content: generateReadme(config) }
  ];

  for (const file of files) {
    const filePath = join(packageDir, file.path);
    await writeFile(filePath, file.content, 'utf-8');
    console.log(`✅ Created: ${file.path}`);
  }

  return packageDir;
}

function printNextSteps(config: PackageConfig, packageDir: string) {
  const fullPackageName = `${config.scope}/${config.packageName}`;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Package created successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📦 Package:', fullPackageName);
  console.log('📁 Location:', packageDir);
  console.log('🔧 First tool:', config.toolName);

  console.log('\n📋 Next Steps:\n');
  console.log(`1. Navigate to package directory:`);
  console.log(`   cd ${packageDir}\n`);
  console.log(`2. Install dependencies:`);
  console.log(`   pnpm install\n`);
  console.log(`3. Build the package:`);
  console.log(`   pnpm build\n`);
  console.log(`4. Add more tools:`);
  console.log(`   - Create new file in src/tools/`);
  console.log(`   - Export from src/index.ts`);
  console.log(`   - Update mcp.config.json tools array\n`);
  console.log(`5. Test your package:`);
  console.log(`   - Add to workspace package.json`);
  console.log(`   - Use autoLoadFromPackages in your MCP server\n`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📚 Documentation:');
  console.log('   - Package structure: README.md');
  console.log('   - MCP config: mcp.config.json');
  console.log('   - Example tool: src/tools/' + config.toolName + '-tool.ts\n');
}

async function main() {
  try {
    const config = await collectPackageInfo();
    const outputDir = process.cwd();

    const packageDir = await createPackage(config, outputDir);
    printNextSteps(config, packageDir);

  } catch (error) {
    console.error('\n❌ Error creating package:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
