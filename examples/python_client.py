"""
GuruWalk affiliate MCP server: Python example.

Connects to the server, lists its tools and calls discover_destination to
find free tours in a city.

Requires Python 3.10+ and version 2 of the MCP SDK:

    pip install "mcp>=2"
    python examples/python_client.py

Reference for every tool, parameter and response field: the "Tools" section
of this repository's README, https://github.com/guruwalk/affiliates-mcp#tools
"""

import asyncio
import json
from typing import Any

import httpx2  # installed with the MCP SDK
from mcp import Client
from mcp.client.streamable_http import streamable_http_client
from mcp.types import CallToolResult, TextContent

# Replace with your affiliate API key (the "API key" section of your affiliate panel).
API_KEY = "YOUR_API_KEY"

MCP_URL = "https://back.guruwalk.com/mcp/affiliates"


def parse_tool_result(result: CallToolResult) -> dict[str, Any]:
    """Return the data of a tool call.

    The server sends it as a JSON string inside the first text block, not as
    structured content, so it has to be parsed.
    """
    block = result.content[0] if result.content else None
    if not isinstance(block, TextContent):
        raise TypeError("The tool result does not start with a text block")

    if result.is_error:
        # The text is either {"error": "<message>"} or a plain message
        # (for example, when a required argument is missing).
        try:
            message = json.loads(block.text)["error"]
        except (ValueError, KeyError, TypeError):
            message = block.text
        raise RuntimeError(f"The tool returned an error: {message}")

    return json.loads(block.text)


async def main() -> None:
    # The key goes in a header on every request; a key in the URL is not read.
    # "Api-Key: YOUR_API_KEY" is accepted as an alternative header. A missing
    # or invalid key is rejected with HTTP 401.
    http_client = httpx2.AsyncClient(
        headers={"Authorization": f"Bearer {API_KEY}"},
        timeout=httpx2.Timeout(10.0, read=30.0),
    )

    async with http_client:
        transport = streamable_http_client(MCP_URL, http_client=http_client)

        # mode="legacy" connects with the initialize handshake.
        async with Client(transport, mode="legacy") as client:
            tools = await client.list_tools()
            print("Available tools:", [tool.name for tool in tools.tools])

            result = await client.call_tool(
                "discover_destination",
                {
                    "destination": "Rome",
                    # Besides translating names, it filters: only tours
                    # offered in this language are listed.
                    "language": "en",
                    # Optional date range. Send both dates or neither; without
                    # them the server uses the next 30 days.
                    # "start_date": "YYYY-MM-DD",
                    # "end_date": "YYYY-MM-DD",
                    "page": 1,
                },
            )
            data = parse_tool_result(result)

            place = data["place"]
            print(f"\nDestination: {place['name']}, {place['country']}")
            print(f"Has free tours: {place['has_free_tours']}")

            # A category id is the category_id argument of browse_category.
            print("\nCategories:")
            for category in data["categories"]:
                print(f"  [{category['id']}] {category['name']}: {category['url']}")

            # A tour id is the tour_id argument of check_availability.
            pagination = data["pagination"]
            print(f"\nTours (page {pagination['page']}, {pagination['total_count']} in total):")
            for tour in data["featured_products"]:
                print(
                    f"  [{tour['id']}] {tour['name']}"
                    f" - {tour['rating_out_of_5']}/5 ({tour['reviews_count']} reviews)"
                )
                # Every link already carries your affiliate code (ref=...).
                print(f"      {tour['url']}")


if __name__ == "__main__":
    asyncio.run(main())
