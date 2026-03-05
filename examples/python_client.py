"""
GuruWalk MCP Affiliate Client — Python example
Requires: pip install mcp httpx

This example connects to the GuruWalk affiliate MCP server and calls
discover_destination to find free tours in a city.
"""

import asyncio
import json

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

# Replace with your affiliate API key.
API_KEY = "your_api_key_here"

# The GuruWalk affiliate MCP endpoint.
MCP_URL = "https://back.guruwalk.com/mcp/affiliates"


async def main() -> None:
    # Build an httpx.AsyncClient that includes the auth header on every request.
    # The server also accepts "Api-Key: <key>" as an alternative header.
    http_client = httpx.AsyncClient(
        headers={"Authorization": f"Bearer {API_KEY}"},
        # connect / read timeouts — adjust as needed
        timeout=httpx.Timeout(10.0, read=30.0),
    )

    async with http_client:
        # Open the Streamable HTTP transport to the remote server.
        # The server is stateless: each call is an independent HTTP request,
        # so no session ID is retained between calls.
        async with streamable_http_client(
            url=MCP_URL,
            http_client=http_client,
        ) as (read_stream, write_stream, _):
            # Wrap the streams in an MCP ClientSession, which handles the
            # JSON-RPC message framing defined by the MCP spec.
            async with ClientSession(read_stream, write_stream) as session:
                # Send the MCP initialize handshake.
                await session.initialize()

                # (Optional) List available tools to confirm the connection.
                tools_result = await session.list_tools()
                tool_names = [t.name for t in tools_result.tools]
                print(f"Available tools: {tool_names}")

                # Call discover_destination to find free tours in Rome.
                result = await session.call_tool(
                    "discover_destination",
                    arguments={
                        "destination": "Rome",
                        "language": "en",
                        # Optionally filter by date range:
                        # "start_date": "2025-06-10",
                        # "end_date": "2025-06-20",
                        "page": 1,
                    },
                )

                # The tool returns its output as a JSON string inside the
                # first text content block.
                raw_text = result.content[0].text
                data = json.loads(raw_text)

                # Print destination summary.
                place = data["place"]
                print(f"\nDestination: {place['name']}, {place['country']}")
                print(f"Has free tours: {place['has_free_tours']}")

                # Print available categories.
                print("\nCategories:")
                for cat in data["categories"]:
                    print(f"  [{cat['id']}] {cat['name']}  →  {cat['url']}")

                # Print featured tours.
                pagination = data["pagination"]
                print(
                    f"\nFeatured tours "
                    f"(page {pagination['page']} of "
                    f"{-(-pagination['total_count'] // pagination['per_page'])}):"
                )
                for product in data["featured_products"]:
                    print(
                        f"  [{product['id']}] {product['name']}"
                        f"  ★ {product['rating_out_of_5']}/5 ({product['reviews_count']} reviews)"
                    )
                    print(f"      {product['url']}")


if __name__ == "__main__":
    asyncio.run(main())
