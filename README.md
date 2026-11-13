# GuruWalk MCP server for affiliates

GuruWalk runs a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for the members of its [affiliate programme](https://www.guruwalk.com/afiliados). It lets your AI assistants and agents look up GuruWalk's free-tour catalogue while they talk with a traveller: which tours a destination has, what a category offers and when a tour runs.

The server only returns free tours. Every guruwalk.com link it returns already carries your affiliate code, so bookings that start from your assistant are attributed to you.

## What it is for

Use it when an AI assistant or agent is in a conversation with a traveller and needs to look up what that traveller is asking about: the free tours of a city, the tours of one kind, the days and times a tour runs.

It is not meant for downloading the catalogue or building tour listings on your site. For that, affiliates have the tours API, documented in the affiliate panel.

## Endpoint

```
POST https://back.guruwalk.com/mcp/affiliates
```

MCP over Streamable HTTP, `POST` only. Any MCP client library works; [Examples](#examples) has one client in Python and one in TypeScript.

## Authentication

Send your API key on every request, in an `Authorization: Bearer YOUR_API_KEY` header or, alternatively, an `Api-Key: YOUR_API_KEY` header.

The key must be enabled and belong to an active affiliate account. Otherwise the server answers HTTP `401` with `{"error": "Unauthorized"}`.

You generate your key in the **API key** section of your affiliate panel.

## How results are returned

A successful `tools/call` returns the tool's data as a JSON string inside the first text content block. Parse that string to get the object shown for each tool below:

```json
{
  "content": [
    { "type": "text", "text": "{\"place\":{\"id\":878,\"name\":\"Madrid\", ...}}" }
  ],
  "isError": false
}
```

When a tool cannot answer, the result has `isError: true` and the text is `{"error": "<message>"}`, or a plain message when an argument is missing or invalid.

## Tools

All tools accept `language`: `en` (default), `es`, `de` or `it`.

### discover_destination

Finds a destination by name and returns its data, the tour categories you can browse there, and a page of its free tours.

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `destination` | string | Yes | | City or destination name, for example `"Rome"`. Matched by name, tolerating small typos. |
| `language` | string | No | `en` | Language of names, slugs and category links. It also **filters the tours**: only tours offered in this language are listed. |
| `start_date` | string | No | now | Only tours with a bookable session from this date (`YYYY-MM-DD`). |
| `end_date` | string | No | 30 days from now | Only tours with a bookable session until this date (`YYYY-MM-DD`), end of day. |
| `page` | integer | No | `1` | Page of `featured_products`, 12 tours per page. |

Only tours with at least one bookable session in the date range are listed. Send both dates or neither: with only `start_date`, the range still ends 30 days from now. A range that starts or ends more than six months ahead is replaced by the next 30 days.

```json
{
  "place": {
    "id": 878,
    "name": "Madrid",
    "slug": "madrid",
    "country": "Spain",
    "has_free_tours": true
  },
  "pagination": { "page": 1, "per_page": 12, "total_count": 34 },
  "categories": [
    {
      "id": 5,
      "name": "Historic centre",
      "url": "https://www.guruwalk.com/madrid/tag/historic-centre?ref=your_affiliate_code"
    }
  ],
  "featured_products": [
    {
      "id": 12345,
      "name": "Old Town Free Tour",
      "slug": "12345-old-town-free-tour",
      "rating_out_of_5": 4.85,
      "reviews_count": 128,
      "image_url": "https://media.guruwalk.com/EXAMPLE_MEDIUM",
      "url": "https://www.guruwalk.com/walks/12345-old-town-free-tour?ref=your_affiliate_code"
    }
  ]
}
```

`image_url` can be an empty string when the tour has no image.

Errors: `No destination found for '<destination>'`, `Destination data not found`, `Invalid date format, use YYYY-MM-DD` (an impossible month or day, such as `2026-13-45`).

### browse_category

Lists the free tours of one category of a destination.

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `category_id` | integer | Yes | | A `categories[].id` returned by `discover_destination`. |
| `language` | string | No | `en` | Language of names, slugs and the category link. Unlike `discover_destination`, it does not filter the tours. |
| `page` | integer | No | `1` | Page of `products`, 12 tours per page. |

Only tours with at least one bookable session in the next 30 days are listed.

```json
{
  "category": {
    "id": 5,
    "name": "Historic centre",
    "url": "https://www.guruwalk.com/madrid/tag/historic-centre?ref=your_affiliate_code"
  },
  "place": { "name": "Madrid", "slug": "madrid" },
  "pagination": { "page": 1, "per_page": 12, "total_count": 8 },
  "products": [
    {
      "id": 12345,
      "name": "Old Town Free Tour",
      "slug": "12345-old-town-free-tour",
      "rating_out_of_5": 4.85,
      "reviews_count": 128,
      "image_url": "https://media.guruwalk.com/EXAMPLE_MEDIUM",
      "url": "https://www.guruwalk.com/walks/12345-old-town-free-tour?ref=your_affiliate_code"
    }
  ]
}
```

Errors: `Category <id> not found`.

### check_availability

Returns the bookable sessions of one free tour, day by day.

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `tour_id` | integer | Yes | | A tour `id` from `discover_destination` or `browse_category`. |
| `from_date` | string | Yes | | First day of the range (`YYYY-MM-DD`). |
| `to_date` | string | Yes | | Last day of the range (`YYYY-MM-DD`), inclusive. **At most 180 days** after `from_date`. |
| `language` | string | No | `en` | Language of the tour slug used in the links. It does not filter the sessions: every language of the tour is returned. |

`dates` has one key per day of the range; a day without bookable sessions has an empty array.

```json
{
  "tour_id": 12345,
  "from_date": "2026-12-10",
  "to_date": "2026-12-11",
  "dates": {
    "2026-12-10": [
      {
        "event_id": 9901,
        "start_time": "10:00",
        "language": "en",
        "last_seats": false,
        "booking_url": "https://www.guruwalk.com/walks/12345-old-town-free-tour?beginsAt=2026-12-10&endsAt=2026-12-10&ref=your_affiliate_code"
      }
    ],
    "2026-12-11": []
  }
}
```

`booking_url` is the tour page for that day, not the booking form: the traveller picks the time and completes the booking there.

Errors: `Date range cannot exceed 180 days`, `Tour not found`, `Invalid date format, use YYYY-MM-DD`.

## Typical flow

```
1. discover_destination(destination: "Barcelona")
   -> destination data, categories and a first page of tours

2. browse_category(category_id: <id from step 1>)          (optional)
   -> the tours of one category

3. check_availability(tour_id: <id from step 1 or 2>, from_date: "...", to_date: "...")
   -> days and times with a link for each one
```

## Attribution

Every `url` and `booking_url` the tools return already carries your affiliate code as `ref=<your username>`. Keep it in the links you show to the traveller: a booking is only attributed through a link that carries it. Your API key never goes in a link.

## Examples

Two runnable clients connect to the server, list its tools and search a destination with `discover_destination`, parsing the result as described in [How results are returned](#how-results-are-returned):

- [`examples/python_client.py`](examples/python_client.py), with the [`mcp`](https://pypi.org/project/mcp/) Python SDK (version 2 or later, on Python 3.10+)
- [`examples/typescript_client.ts`](examples/typescript_client.ts), with the [`@modelcontextprotocol/sdk`](https://www.npmjs.com/package/@modelcontextprotocol/sdk) TypeScript SDK

Each file starts with the commands to install its SDK and run it. Replace `YOUR_API_KEY` with your own key first.
