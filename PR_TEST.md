# Pull Request Environment Test

This file exists to test PR preview environments.

## Expected Behavior

When a PR is created:
1. GitHub Actions builds the app with DEV Supabase credentials
2. Azure Static Web Apps creates a staging environment
3. Environment variables set:
   - `VITE_SUPABASE_URL` → DEV Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → DEV Supabase publishable key
   - `VITE_ENV` → "preview"

## Validation

Check the build logs for the PR to verify:
- Build step shows `VITE_ENV: preview`
- Deployment creates a staging URL (e.g., `<app>-<pr-number>.azurestaticapps.net`)
- App connects to DEV Supabase (not PROD)

This file can be deleted after validation.
