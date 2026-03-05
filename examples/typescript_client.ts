/**
 * GuruWalk MCP Affiliate Client — TypeScript example
 * Requires: npm install @modelcontextprotocol/sdk
 *
 * This example connects to the GuruWalk affiliate MCP server and calls
 * discover_destination to find free tours in a city.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Replace with your affiliate API key.
const API_KEY = "your_api_key_here";

// The GuruWalk affiliate MCP endpoint.
const MCP_URL = "https://back.guruwalk.com/mcp/affiliates";

// --- Type definitions matching the discover_destination response DTOs ---

interface PlaceDto {
  id: number;
  name: string;
  slug: string;
  country: string;
  has_free_tours: boolean;
}

interface PaginationDto {
  page: number;
  per_page: number;
  total_count: number;
}

interface CategoryDto {
  id: number;
  name: string | null;
  url: string;
}

interface ProductDto {
  id: number;
  name: string;
  slug: string;
  rating_out_of_5: number; // 1.0–5.0
  reviews_count: number;
  image_url: string | null;
  url: string;
}

interface DiscoverDestinationResponse {
  place: PlaceDto;
  pagination: PaginationDto;
  categories: CategoryDto[];
  featured_products: ProductDto[];
}

// -----------------------------------------------------------------------

async function main(): Promise<void> {
  // Create an MCP client instance with a descriptive name and version.
  const client = new Client(
    { name: "guruwalk-affiliate-example", version: "1.0.0" },
    { capabilities: {} }
  );

  // Build the Streamable HTTP transport pointing at the remote server.
  // The server is stateless: each call is an independent HTTP request.
  // Auth is passed in the requestInit headers included with every request.
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: {
      headers: {
        // The server also accepts "Api-Key: <key>" as an alternative.
        Authorization: `Bearer ${API_KEY}`,
      },
    },
  });

  // Connect — this performs the MCP initialize handshake.
  await client.connect(transport);
  console.log("Connected to GuruWalk MCP server");

  // (Optional) List available tools to confirm the connection.
  const toolsResult = await client.listTools();
  const toolNames = toolsResult.tools.map((t) => t.name);
  console.log("Available tools:", toolNames);

  // Call discover_destination to find free tours in Rome.
  const result = await client.callTool({
    name: "discover_destination",
    arguments: {
      destination: "Rome",
      language: "en",
      // Optionally filter by date range:
      // start_date: "2025-06-10",
      // end_date: "2025-06-20",
      page: 1,
    },
  });

  // The tool returns its output as a JSON string inside the first text
  // content block. Parse it into the typed response shape.
  const firstContent = result.content[0];
  if (firstContent.type !== "text") {
    throw new Error(`Unexpected content type: ${firstContent.type}`);
  }

  const data: DiscoverDestinationResponse = JSON.parse(firstContent.text);

  // Print destination summary.
  const { place, pagination, categories, featured_products } = data;
  console.log(`\nDestination: ${place.name}, ${place.country}`);
  console.log(`Has free tours: ${place.has_free_tours}`);

  // Print available categories.
  console.log("\nCategories:");
  for (const cat of categories) {
    console.log(`  [${cat.id}] ${cat.name}  →  ${cat.url}`);
  }

  // Print featured tours.
  const totalPages = Math.ceil(pagination.total_count / pagination.per_page);
  console.log(
    `\nFeatured tours (page ${pagination.page} of ${totalPages}):`
  );
  for (const product of featured_products) {
    console.log(
      `  [${product.id}] ${product.name}` +
        `  ★ ${product.rating_out_of_5}/5 (${product.reviews_count} reviews)`
    );
    console.log(`      ${product.url}`);
  }

  // Close the connection cleanly.
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
