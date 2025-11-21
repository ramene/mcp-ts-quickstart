/**
 * Package-Based Auto-Loader for MCP Tool Packages
 *
 * Discovers and loads MCP tools from npm packages in node_modules.
 * Enables modular, composable tool ecosystems where domain-specific
 * tools are distributed as independent npm packages.
 *
 * Package naming convention: @scope/mcp-domain-tools
 * Example: @think-arch/mcp-substack-tools, @think-arch/mcp-github-tools
 */

import { readdir, readFile, access } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RegisterableModule, LoadResult } from './registry-types.ts';
import { autoLoadModules } from './auto-loader.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * MCP Tool Package Configuration
 */
interface MCPPackageConfig {
  type: 'mcp-tools';
  name: string;
  version: string;
  toolsDir?: string;
  domain?: string;
  requirements?: {
    env?: string[];
    sdk?: string;
  };
  tools?: string[];
}

/**
 * Package Discovery Result
 */
interface PackageDiscoveryResult {
  packages: Array<{
    name: string;
    path: string;
    config: MCPPackageConfig;
  }>;
  loadResults: LoadResult[];
}

/**
 * Enhanced auto-loader that discovers and loads tools from:
 * 1. npm packages in node_modules (@scope/mcp-*)
 * 2. Local tools directory (./src/tools)
 * 3. Custom paths (via MCP_TOOL_PATHS env var)
 *
 * @param server - MCP server instance
 * @param options - Configuration options
 * @returns Discovery and load results
 *
 * @example
 * ```typescript
 * // Auto-discover all tool packages
 * await autoLoadFromPackages(server, { verbose: true });
 *
 * // Selective loading
 * await autoLoadFromPackages(server, {
 *   scope: '@think-arch',
 *   enabledPackages: ['mcp-github-tools']
 * });
 * ```
 */
export async function autoLoadFromPackages(
  server: McpServer,
  options: {
    verbose?: boolean;
    scope?: string;
    enabledPackages?: string[];
    disabledTools?: string[];
    throwOnError?: boolean;
  } = {}
): Promise<PackageDiscoveryResult> {
  const {
    verbose = true,
    scope = '@think-arch',
    enabledPackages,
    disabledTools = [],
    throwOnError = false
  } = options;

  const result: PackageDiscoveryResult = {
    packages: [],
    loadResults: []
  };

  if (verbose) {
    console.error('\n🔍 Discovering MCP tool packages...');
  }

  // Step 1: Find tool packages in node_modules
  const packages = await discoverToolPackages(scope, verbose);

  // Step 2: Filter enabled packages
  const filteredPackages = enabledPackages
    ? packages.filter(pkg => enabledPackages.includes(pkg.name))
    : packages;

  result.packages = filteredPackages;

  if (verbose && filteredPackages.length > 0) {
    console.error(`📦 Found ${filteredPackages.length} tool package(s):`);
    filteredPackages.forEach(pkg => {
      console.error(`   - ${pkg.config.name} (${pkg.config.domain || 'unknown domain'})`);
    });
  }

  // Step 3: Load tools from each package
  for (const pkg of filteredPackages) {
    if (verbose) {
      console.error(`\n📥 Loading tools from ${pkg.config.name}...`);
    }

    const toolsPath = join(pkg.path, pkg.config.toolsDir || 'tools');

    try {
      const loadResult = await loadModulesFromDirectory(
        server,
        toolsPath,
        { verbose, throwOnError, disabledTools }
      );

      result.loadResults.push(loadResult);
    } catch (error) {
      console.error(`❌ Failed to load tools from ${pkg.config.name}:`, error);
      if (throwOnError) throw error;
    }
  }

  // Step 4: Load local tools (these override package tools if same name)
  // NOTE: Commented out for mcp app since all tools are now in packages
  // Uncomment this section if you have additional local tools that override packages
  /*
  if (verbose) {
    console.error('\n📁 Loading local tools...');
  }

  try {
    const localResult = await autoLoadModules(
      server,
      '../tools',
      { verbose, throwOnError }
    );
    result.loadResults.push(localResult);
  } catch (error) {
    console.error('❌ Failed to load local tools:', error);
    if (throwOnError) throw error;
  }
  */

  // Step 5: Print overall summary
  if (verbose) {
    printOverallSummary(result);
  }

  return result;
}

/**
 * Discover tool packages in node_modules
 */
async function discoverToolPackages(
  scope: string,
  verbose: boolean
): Promise<Array<{ name: string; path: string; config: MCPPackageConfig }>> {
  const packages: Array<{ name: string; path: string; config: MCPPackageConfig }> = [];

  // Find project root (where node_modules lives)
  const projectRoot = await findProjectRoot();
  if (!projectRoot) {
    if (verbose) {
      console.error('⚠️  Could not find node_modules directory');
    }
    return packages;
  }

  const nodeModulesPath = join(projectRoot, 'node_modules', scope);

  try {
    // Check if scoped directory exists
    await access(nodeModulesPath);

    // Read all packages in scope
    const scopedPackages = await readdir(nodeModulesPath);

    // Filter for mcp-* packages
    const mcpPackages = scopedPackages.filter(pkg => pkg.startsWith('mcp-'));

    // Load and validate each package
    for (const pkgName of mcpPackages) {
      const pkgPath = join(nodeModulesPath, pkgName);
      const configPath = join(pkgPath, 'mcp.config.json');

      try {
        // Check if mcp.config.json exists
        await access(configPath);

        const configContent = await readFile(configPath, 'utf-8');
        const config = JSON.parse(configContent) as MCPPackageConfig;

        // Validate config
        if (config.type === 'mcp-tools') {
          packages.push({
            name: pkgName,
            path: pkgPath,
            config
          });
        }
      } catch (error) {
        // Skip packages without valid config
        if (verbose) {
          console.error(`⏭️  Skipped ${scope}/${pkgName}: No valid mcp.config.json`);
        }
      }
    }

  } catch (error) {
    // node_modules/@scope doesn't exist - that's okay
    if (verbose) {
      console.error(`ℹ️  No packages found at ${nodeModulesPath}`);
    }
  }

  return packages;
}

/**
 * Load modules from a specific directory
 */
async function loadModulesFromDirectory(
  server: McpServer,
  directory: string,
  options: {
    verbose?: boolean;
    throwOnError?: boolean;
    disabledTools?: string[];
  }
): Promise<LoadResult> {
  const { verbose = true, throwOnError = false, disabledTools = [] } = options;

  const result: LoadResult = {
    loaded: [],
    skipped: [],
    errors: []
  };

  try {
    const files = await readdir(directory);
    const toolFiles = files.filter(f =>
      (f.endsWith('.ts') || f.endsWith('.js')) && !f.endsWith('.d.ts')
    );

    for (const file of toolFiles) {
      const modulePath = join(directory, file);

      try {
        const module = await import(modulePath);

        if (!module.default) {
          result.skipped.push({
            file,
            reason: 'No default export'
          });
          continue;
        }

        const registerable = module.default as RegisterableModule;

        // Check if tool is disabled
        if (disabledTools.includes(registerable.name)) {
          result.skipped.push({
            file,
            reason: 'Disabled via configuration'
          });
          if (verbose) {
            console.error(`⏭️  Skipped ${registerable.name}: Disabled`);
          }
          continue;
        }

        // Validate structure
        if (!isValidModule(registerable)) {
          result.skipped.push({
            file,
            reason: 'Invalid module structure'
          });
          continue;
        }

        // Register the module
        registerable.register(server);

        result.loaded.push({
          type: registerable.type,
          name: registerable.name,
          path: modulePath
        });

        if (verbose) {
          const emoji = getEmojiForType(registerable.type);
          console.error(`${emoji} Registered ${registerable.type}: ${registerable.name}`);
        }

      } catch (error) {
        result.errors.push({
          file,
          error: error as Error
        });
        console.error(`❌ Error loading ${file}:`, error);
      }
    }

  } catch (error) {
    console.error(`❌ Error reading directory ${directory}:`, error);
    if (throwOnError) throw error;
  }

  return result;
}

/**
 * Find project root (where package.json and node_modules live)
 */
async function findProjectRoot(): Promise<string | null> {
  let currentPath = resolve(__dirname);

  // Walk up the directory tree
  for (let i = 0; i < 10; i++) {
    const nodeModulesPath = join(currentPath, 'node_modules');

    try {
      await access(nodeModulesPath);
      return currentPath;
    } catch {
      // Not found, go up one level
      const parentPath = dirname(currentPath);
      if (parentPath === currentPath) {
        // Reached root
        break;
      }
      currentPath = parentPath;
    }
  }

  return null;
}

/**
 * Validate module structure
 */
function isValidModule(obj: any): obj is RegisterableModule {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.type === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.register === 'function'
  );
}

/**
 * Get emoji for module type
 */
function getEmojiForType(type: string): string {
  const emojis: Record<string, string> = {
    tool: '🔧',
    resource: '📦',
    prompt: '💬'
  };
  return emojis[type] || '✅';
}

/**
 * Print overall summary
 */
function printOverallSummary(result: PackageDiscoveryResult): void {
  const totalLoaded = result.loadResults.reduce((sum, r) => sum + r.loaded.length, 0);
  const totalSkipped = result.loadResults.reduce((sum, r) => sum + r.skipped.length, 0);
  const totalErrors = result.loadResults.reduce((sum, r) => sum + r.errors.length, 0);

  console.error('\n' + '═'.repeat(60));
  console.error('📊 Overall Loading Summary');
  console.error('═'.repeat(60));
  console.error(`📦 Packages discovered: ${result.packages.length}`);
  console.error(`✅ Tools loaded: ${totalLoaded}`);
  console.error(`⏭️  Tools skipped: ${totalSkipped}`);
  console.error(`❌ Errors: ${totalErrors}`);
  console.error('═'.repeat(60) + '\n');
}
