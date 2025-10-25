# VHS Vault - Deployment Guide

## Security Update: TMDB API Proxy

This application now uses Supabase Edge Functions to securely proxy TMDB API requests, removing the hardcoded API key from the frontend.

## Prerequisites

1. **Supabase Account**: Make sure you have a Supabase project set up
2. **Supabase CLI**: Install the Supabase CLI globally:
   ```bash
   npm install -g supabase
   ```
3. **TMDB API Key**: Get your API key from [TMDB](https://www.themoviedb.org/settings/api)

## Local Development Setup

### 1. Link Your Supabase Project

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref
```

### 2. Set Up Environment Variables

Create a `.env` file in the `supabase` directory:

```bash
cd supabase
cp .env.example .env
```

Edit `supabase/.env` and add your TMDB API key:

```
TMDB_API_KEY=your_actual_tmdb_api_key_here
```

**IMPORTANT**: Never commit this `.env` file to version control!

### 3. Start Local Development

```bash
# Start Supabase locally (optional, for local testing)
supabase start

# Serve Edge Functions locally with environment variables
supabase functions serve --env-file ./supabase/.env
```

Your Edge Functions will be available at:
- `http://localhost:54321/functions/v1/tmdb-search`
- `http://localhost:54321/functions/v1/tmdb-details`

## Production Deployment

### 1. Set Production Secrets

```bash
# Set the TMDB API key as a secret in Supabase
supabase secrets set TMDB_API_KEY=your_actual_tmdb_api_key_here
```

### 2. Deploy Edge Functions

```bash
# Deploy all Edge Functions
supabase functions deploy tmdb-search
supabase functions deploy tmdb-details
```

Or deploy them individually:

```bash
supabase functions deploy tmdb-search
supabase functions deploy tmdb-details
```

### 3. Verify Deployment

After deployment, your Edge Functions will be available at:
- `https://your-project-ref.supabase.co/functions/v1/tmdb-search`
- `https://your-project-ref.supabase.co/functions/v1/tmdb-details`

### 4. Deploy Frontend

Build and deploy your React application as usual:

```bash
npm run build
```

Then deploy the `build` folder to your hosting provider (Vercel, Netlify, etc.).

## Testing

### Test TMDB Search Locally

```bash
curl -X POST http://localhost:54321/functions/v1/tmdb-search \
  -H "Content-Type: application/json" \
  -d '{"query": "The Matrix", "year": "1999"}'
```

### Test TMDB Details Locally

```bash
curl -X POST http://localhost:54321/functions/v1/tmdb-details \
  -H "Content-Type: application/json" \
  -d '{"movieId": 603}'
```

## Troubleshooting

### Edge Function Not Working

1. **Check if the secret is set**:
   ```bash
   supabase secrets list
   ```

2. **Check function logs**:
   ```bash
   supabase functions logs tmdb-search
   supabase functions logs tmdb-details
   ```

3. **Verify deployment**:
   ```bash
   supabase functions list
   ```

### CORS Errors

The Edge Functions are configured to allow CORS from any origin (`Access-Control-Allow-Origin: *`). If you need to restrict this to your specific domain, edit the `corsHeaders` in each Edge Function.

### API Key Issues

- Make sure your TMDB API key is valid and active
- Check that the secret is set correctly in Supabase
- Verify the environment variable is loaded in local development

## Security Notes

✅ **What's Been Fixed:**
- TMDB API key is no longer exposed in the frontend code
- API key is stored as a Supabase secret (production) or environment variable (local)
- All TMDB requests are proxied through secure backend Edge Functions

⚠️ **Additional Security Recommendations:**
1. Consider adding rate limiting to the Edge Functions
2. Implement user authentication checks if needed
3. Monitor Edge Function logs for abuse
4. Rotate your TMDB API key if the old one was exposed

## Additional Resources

- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [TMDB API Documentation](https://developers.themoviedb.org/3)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli/introduction)
