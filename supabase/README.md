# Supabase Edge Functions

This directory contains Supabase Edge Functions for the VHS Vault application.

## Setup

1. Install the Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Create a `.env` file in this directory based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. Add your TMDB API key to the `.env` file:
   ```
   TMDB_API_KEY=your_actual_api_key_here
   ```

## Available Functions

### tmdb-search
Proxies movie search requests to TMDB API.

**Endpoint:** `/functions/v1/tmdb-search`

**Request:**
```json
{
  "query": "The Matrix",
  "year": "1999"  // optional
}
```

**Response:**
Returns TMDB search results.

### tmdb-details
Proxies movie details requests to TMDB API.

**Endpoint:** `/functions/v1/tmdb-details`

**Request:**
```json
{
  "movieId": 603
}
```

**Response:**
Returns TMDB movie details with credits.

## Local Development

To run Edge Functions locally:

```bash
supabase start
supabase functions serve --env-file ./supabase/.env
```

## Deployment

To deploy Edge Functions to Supabase:

```bash
# Set the TMDB_API_KEY secret
supabase secrets set TMDB_API_KEY=your_actual_api_key_here

# Deploy all functions
supabase functions deploy tmdb-search
supabase functions deploy tmdb-details
```

## Security

- The TMDB API key is stored as an environment variable/secret and never exposed to the frontend
- CORS is configured to allow requests from your application
- All requests are validated before being proxied to TMDB
