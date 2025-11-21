# Modular MCP Tool Packages

## Overview

The Enhanced MCP Quickstart now supports a modular package system that allows you to distribute and share MCP tools as independent npm packages. This enables:

- **Modularity**: Tools are self-contained with their own dependencies
- **Reusability**: Any MCP server can install and use your tool packages
- **Maintainability**: Each package can be versioned and tested independently
- **Developer Experience**: Simple `pnpm add @scope/mcp-*-tools` to add new tools

## Package Structure

MCP tool packages follow a standard structure:

```
@scope/mcp-domain-tools/
├── package.json          # npm package config
├── mcp.config.json      # MCP package metadata
├── tsconfig.json        # TypeScript config (allows .ts imports)
├── tsconfig.build.json  # Build config (for compilation)
├── scripts/
│   └── build.mjs        # Custom build script (transforms imports)
├── src/
│   ├── index.ts         # Main export file
│   ├── lib/             # Shared library code
│   │   ├── client.ts
│   │   ├── types.ts
│   │   └── registry-types.ts
│   └── tools/           # Individual tool wrappers
│       ├── tool-one.ts
│       └── tool-two.ts
└── dist/                # Compiled output
    ├── index.js
    ├── lib/
    └── tools/
```

## Creating a Tool Package

### Quick Start: Using the Package Generator

The fastest way to create a new MCP tool package is using the built-in generator:

```bash
npm run create-package
```

The interactive generator will prompt you for:
- **Package scope**: Your organization or personal scope (e.g., `@your-org`)
- **Domain**: The service/domain you're integrating (e.g., `github`, `slack`, `notion`)
- **Description**: What your package does
- **Author**: Your name and email
- **First tool**: Initial tool name and description

**Generator Output**:
```
@your-scope/mcp-domain-tools/
├── package.json              ✅ Configured with MCP dependencies
├── mcp.config.json          ✅ Package metadata
├── tsconfig.json            ✅ TypeScript configuration
├── README.md                ✅ Usage documentation
├── src/
│   ├── index.ts             ✅ Exports all tools
│   ├── lib/
│   │   ├── registry-types.ts ✅ Type definitions
│   │   └── types.ts         ✅ Domain-specific types
│   └── tools/
│       └── your-tool.ts     ✅ Example tool implementation
```

**Next Steps After Generation**:
1. `cd mcp-domain-tools`
2. `pnpm install`
3. `pnpm build`
4. Add more tools to `src/tools/`
5. Test with package auto-loader

### Manual Creation

Alternatively, you can create packages manually:

### 1. Package Configuration (package.json)

```json
{
  "name": "@your-scope/mcp-your-domain-tools",
  "version": "1.0.0",
  "description": "MCP tools for your domain",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "node scripts/build.mjs",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "your-api-lib": "^1.0.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@modelcontextprotocol/sdk": "^1.22.0",
    "@types/node": "^22.10.2",
    "glob": "^11.0.0",
    "typescript": "^5.7.0"
  }
}
```

### 2. MCP Package Metadata (mcp.config.json)

```json
{
  "type": "mcp-tools",
  "name": "@your-scope/mcp-your-domain-tools",
  "version": "1.0.0",
  "toolsDir": "dist/tools",
  "domain": "your-domain",
  "requirements": {
    "env": ["YOUR_API_KEY", "YOUR_CONFIG"],
    "sdk": "^1.22.0"
  },
  "tools": [
    "your-tool-one",
    "your-tool-two"
  ]
}
```

### 3. Tool Implementation

Each tool follows the `RegisterableModule` pattern:

```typescript
// src/tools/your-tool.ts
import type { RegisterableModule } from '../lib/registry-types.js';
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { YourToolInputSchema } from '../lib/schemas.js';
import { getYourClient } from '../lib/client.js';

const yourTool: RegisterableModule = {
  type: 'tool',
  name: 'your-tool-name',
  description: 'Description of what your tool does',

  register(server: McpServer) {
    server.tool(
      this.name,
      this.description,
      YourToolInputSchema.shape,
      async (args: unknown) => {
        const client = getYourClient();
        const result = await client.doSomething(args);

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
    );
  }
};

export default yourTool;
```

### 4. Build System

The build script preserves `.ts` imports in source (for monorepo compatibility) while transforming them to `.js` during compilation:

```javascript
// scripts/build.mjs
#!/usr/bin/env node
import { cpSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { glob } from 'glob';

console.log('📦 Starting build process...\n');

// Step 1: Copy source to .build
cpSync('src', '.build', { recursive: true });

// Step 2: Transform .ts imports to .js
const files = glob.sync('.build/**/*.ts');
files.forEach(file => {
  let content = readFileSync(file, 'utf-8');
  content = content.replace(/(from\s+['"])([^'"]+)\.ts(['"])/g, (match, prefix, path, suffix) => {
    return path.startsWith('.') ? `${prefix}${path}.js${suffix}` : match;
  });
  writeFileSync(file, content);
});

// Step 3: Compile TypeScript
execSync('pnpm exec tsc --project tsconfig.build.json', { stdio: 'inherit' });

// Step 4: Cleanup
rmSync('.build', { recursive: true, force: true });
console.log('✅ Build complete!\n');
```

## Using Tool Packages

### Installation

```bash
# Install a tool package
pnpm add @your-scope/mcp-your-domain-tools

# Or for workspace packages
pnpm add @your-scope/mcp-your-domain-tools@workspace:*
```

### Loading Packages

In your MCP server's `index.ts`:

```typescript
import { autoLoadFromPackages } from './registry/package-loader.ts';

// Load all packages from a scope
await autoLoadFromPackages(server, {
  scope: '@your-scope',
  verbose: true,
  throwOnError: false
});

// Load specific packages only
await autoLoadFromPackages(server, {
  scope: '@your-scope',
  enabledPackages: ['mcp-github-tools', 'mcp-database-tools'],
  verbose: true,
  throwOnError: false
});
```

## Package Discovery

The package loader automatically discovers MCP tool packages by:

1. Scanning `node_modules/@scope/mcp-*` directories
2. Reading `mcp.config.json` for package metadata
3. Loading tools from the specified `toolsDir`
4. Registering each tool with the MCP server

## Example Packages

### GitHub Tools
```
@think-arch/mcp-github-tools
- list-projects: List GitHub projects
- sync-architecture: Sync architecture docs
```

### Substack Tools
```
@think-arch/mcp-substack-tools
- 16 tools for Substack content management
- Content analysis, engagement tracking, publishing
```

## Best Practices

1. **Self-Contained**: Each package should include all necessary library code
2. **Type Safety**: Use Zod for input validation and TypeScript for type safety
3. **Error Handling**: Implement proper error handling with custom error types
4. **Documentation**: Include clear descriptions and usage examples
5. **Testing**: Add comprehensive tests for each tool
6. **Versioning**: Follow semantic versioning for package releases

## Development Workflow

1. **Create** package structure with `mcp.config.json`
2. **Implement** tools following RegisterableModule pattern
3. **Build** package with custom build script
4. **Test** using `pnpm link` for local development
5. **Publish** to npm or use in monorepo workspaces

## Package Template

Use the Package Generator tool (coming soon) to scaffold new MCP tool packages with the correct structure and configuration.

## See Also

- [Registry Types](../src/registry/registry-types.ts) - Type definitions
- [Package Loader](../src/registry/package-loader.ts) - Auto-discovery system
- [Example Packages](../../@builds.karve.ai/packages/) - Reference implementations
