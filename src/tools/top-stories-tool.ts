/**
 * Top Stories Tool - Converted to Registerable Pattern
 * 
 * Fetches top stories from Hacker News API.
 * 
 * This is the original example tool converted to use the registerable
 * pattern for auto-loading.
 */

import { z, type RegisterableModule } from '@think-arch/mcp-framework-core';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Fetch top stories from Hacker News
 */
async function fetchTopStories(limit: number = 10): Promise<string> {
  try {
    // Fetch top story IDs
    const topStoriesResponse = await fetch(
      'https://hacker-news.firebaseio.com/v0/topstories.json'
    );
    const topStoryIds = await topStoriesResponse.json();

    // Fetch details for top N stories
    const storyPromises = topStoryIds
      .slice(0, limit)
      .map(async (id: number) => {
        const storyResponse = await fetch(
          `https://hacker-news.firebaseio.com/v0/item/${id}.json`
        );
        return storyResponse.json();
      });

    const stories = await Promise.all(storyPromises);

    // Format stories
    return stories
      .map((story, index) => {
        return `${index + 1}. ${story.title}\n   ${story.url || `https://news.ycombinator.com/item?id=${story.id}`}\n   ${story.score} points | ${story.descendants || 0} comments`;
      })
      .join('\n\n');
  } catch (error) {
    throw new Error(`Failed to fetch Hacker News stories: ${error}`);
  }
}

/**
 * Registerable module definition
 */
const topStoriesModule: RegisterableModule = {
  type: 'tool',
  name: 'topStories',
  description: 'Fetches the top stories from Hacker News',
  
  metadata: {
    author: 'MCP Quickstart',
    version: '1.0.0',
    tags: ['hacker-news', 'news', 'example']
  },
  
  register(server: McpServer) {
    server.tool(
      this.name,
      this.description,
      {
        limit: z
          .number()
          .optional()
          .default(10)
          .describe('Number of stories to fetch (default: 10, max: 30)')
      },
      async ({ limit }) => {
        // Validate and cap limit
        const actualLimit = Math.min(Math.max(limit || 10, 1), 30);
        
        const stories = await fetchTopStories(actualLimit);
        
        return {
          content: [
            {
              type: 'text',
              text: `Top ${actualLimit} Hacker News Stories:\n\n${stories}`
            }
          ]
        };
      }
    );
  }
};

export default topStoriesModule;