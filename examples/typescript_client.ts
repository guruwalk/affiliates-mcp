/**
 * GuruWalk affiliate MCP server: TypeScript example.
 *
 * Connects to the server, lists its tools and calls discover_destination to
 * find free tours in a city.
 *
 *   npm install @modelcontextprotocol/sdk
 *   npx tsx examples/typescript_client.ts
 *
 * Reference for every tool, parameter and response field: the "Tools" section
 * of this repository's README, https://github.com/guruwalk/affiliates-mcp#tools
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

// Replace with your affiliate API key (the "API key" section of your affiliate panel).
const API_KEY = "YOUR_API_KEY";

const MCP_URL = "https://back.guruwalk.com/mcp/affiliates";

// Shape of the data returned by discover_destination.

interface Place {
  id: number;
  name: string;
  slug: string;
  country: string;
  has_free_tours: boolean;
}

interface Pagination {
  page: number;
  per_page: number;
  total_count: number;
}

interface Category {
  id: number; // the category_id argument of browse_category
  name: string | null;
  url: string;
}

interface Tour {
  id: number; // the tour_id argument of check_availability
  name: string;
  slug: string;
  rating_out_of_5: number;
  reviews_count: number;
  image_url: string; // empty string when the tour has no image
  url: string;
}

interface DiscoverDestinationData {
  place: Place;
  pagination: Pagination;
  categories: Category[];
  featured_products: Tour[];
}

/**
 * Returns the data of a tool call. The server sends it as a JSON string
 * inside the first text block, not as structured content, so it has to be
 * parsed.
 */
function parseToolResult<T>(rawResult: unknown): T {
  const result = CallToolResultSchema.parse(rawResult);
  const block = result.content[0];
  if (block?.type !== "text") {
    throw new Error("The tool result does not start with a text block");
  }

  if (result.isError) {
    // The text is either {"error": "<message>"} or a plain message
    // (for example, when a required argument is missing).
    let message = block.text;
    try {
      message = JSON.parse(block.text).error ?? message;
    } catch {
      // Not JSON: keep the plain message.
    }
    throw new Error(`The tool returned an error: ${message}`);
  }

  return JSON.parse(block.text) as T;
}

async function main(): Promise<void> {
  const client = new Client({ name: "guruwalk-affiliate-example", version: "1.0.0" });

  // The key goes in a header on every request; a key in the URL is not read.
  // "Api-Key: YOUR_API_KEY" is accepted as an alternative header. A missing
  // or invalid key is rejected with HTTP 401.
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: {
      headers: { Authorization: `Bearer ${API_KEY}` },
    },
  });

  await client.connect(transport);

  try {
    const { tools } = await client.listTools();
    console.log("Available tools:", tools.map((tool) => tool.name));

    const result = await client.callTool({
      name: "discover_destination",
      arguments: {
        destination: "Rome",
        // Besides translating names, it filters: only tours offered in this
        // language are listed.
        language: "en",
        // Optional date range. Send both dates or neither; without them the
        // server uses the next 30 days.
        // start_date: "YYYY-MM-DD",
        // end_date: "YYYY-MM-DD",
        page: 1,
      },
    });
    const data = parseToolResult<DiscoverDestinationData>(result);

    const { place, pagination, categories, featured_products: tours } = data;
    console.log(`\nDestination: ${place.name}, ${place.country}`);
    console.log(`Has free tours: ${place.has_free_tours}`);

    console.log("\nCategories:");
    for (const category of categories) {
      console.log(`  [${category.id}] ${category.name}: ${category.url}`);
    }

    console.log(`\nTours (page ${pagination.page}, ${pagination.total_count} in total):`);
    for (const tour of tours) {
      console.log(
        `  [${tour.id}] ${tour.name} - ${tour.rating_out_of_5}/5 (${tour.reviews_count} reviews)`
      );
      // Every link already carries your affiliate code (ref=...).
      console.log(`      ${tour.url}`);
    }
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
