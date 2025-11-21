/**
 * Enhanced MCP TypeScript Quickstart
 *
 * Features:
 * - Auto-loading of tools, resources, and prompts
 * - Modular package system for distributing tools as npm packages
 * - HTTP/SSE transport support for remote access
 * - Build-less TypeScript using Node v23+
 *
 * Based on: https://github.com/cephalization/mcp-ts-quickstart
 * Enhanced with patterns from fastmcp and alexanderop/mcp-server-starter-ts
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { autoLoadModules } from './registry/auto-loader.ts';
import { autoLoadFromPackages } from './registry/package-loader.ts';
import { startHTTPServer, setupGracefulShutdown } from './transports/http-sse-transport.ts';

// Create MCP server
const server = new McpServer({
  name: 'enhanced-mcp-quickstart',
  version: '1.0.0',
});

// Environment configuration
const TRANSPORT = process.env.MCP_TRANSPORT || 'stdio';
const VERBOSE = process.env.MCP_VERBOSE !== 'false';

/**
 * Logging helper - writes to stderr in stdio mode, stdout otherwise
 *
 * In stdio mode, stdout is reserved for JSON-RPC messages only.
 * All logging must go to stderr to avoid protocol errors.
 */
function log(message: string) {
  if (TRANSPORT === 'stdio') {
    console.error(message);
  } else {
    console.log(message);
  }
}

/**
 * Initialize and start the MCP server
 */
async function main() {
  log('🚀 Starting Enhanced MCP Server...\n');

  // Auto-load all modules
  log('📦 Loading modules...');

  try {
    // OPTIONAL: Load tools from npm packages
    // Uncomment to enable package-based tools:
    /*
    await autoLoadFromPackages(server, {
      scope: '@your-scope',              // e.g., '@think-arch'
      enabledPackages: [],               // Leave empty to load all, or specify: ['mcp-github-tools']
      verbose: VERBOSE,
      throwOnError: false
    });
    */

    // Load local tools
    await autoLoadModules(server, '../tools', { verbose: VERBOSE });

    // Load resources (if directory exists)
    try {
      await autoLoadModules(server, '../resources', {
        verbose: VERBOSE,
        throwOnError: false
      });
    } catch (error) {
      if (VERBOSE) {
        log('ℹ️  No resources directory found (optional)');
      }
    }

    // Load prompts (if directory exists)
    try {
      await autoLoadModules(server, '../prompts', {
        verbose: VERBOSE,
        throwOnError: false
      });
    } catch (error) {
      if (VERBOSE) {
        log('ℹ️  No prompts directory found (optional)');
      }
    }

  } catch (error) {
    console.error('❌ Failed to load modules:', error);
    process.exit(1);
  }

  // Start appropriate transport
  log(`\n🔌 Starting ${TRANSPORT} transport...`);

  if (TRANSPORT === 'http' || TRANSPORT === 'http-sse') {
    // HTTP/SSE mode - for remote access
    const app = await startHTTPServer(server, {
      port: parseInt(process.env.MCP_PORT || '3000'),
      cors: process.env.MCP_CORS !== 'false',
      corsOrigins: process.env.MCP_CORS_ORIGINS?.split(',') || ['*']
    });

    setupGracefulShutdown(app);

  } else {
    // Stdio mode - default for Claude Desktop
    log('📱 Connected via stdio (Claude Desktop mode)');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Keep process alive
    process.stdin.resume();
  }
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});