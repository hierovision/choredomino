# DNS Configuration Workflow Test Guide

## Current Status

**Static Web App:**
- Name: `choredomino`
- Resource Group: `choredomino_group`
- Azure Hostname: `happy-hill-05779860f.2.azurestaticapps.net`
- Custom Domain: Not configured yet

**DNS Status:**
- Current: `www.choredomino.com` → `uixie.porkbun.com` (Porkbun parking page)
- Target: `www.choredomino.com` → `happy-hill-05779860f.2.azurestaticapps.net`

## How to Run the DNS Configuration Workflow

### Option 1: GitHub UI (Recommended for First Run)
1. Go to: https://github.com/hierovision/choredomino/actions
2. Click on "Configure Azure Custom Domain" workflow
3. Click "Run workflow" button
4. Select branch: `main`
5. Click "Run workflow"

### Option 2: GitHub CLI
```bash
gh workflow run "Configure Azure Custom Domain"

# Watch the workflow
gh run watch
```

## What the Workflow Does

1. **Gets Azure Static Web App details**
   - Retrieves hostname: `happy-hill-05779860f.2.azurestaticapps.net`

2. **Checks existing DNS records**
   - Queries Porkbun API for current CNAME
   - Compares with Azure hostname
   - Skips if already configured correctly

3. **Updates DNS (if needed)**
   - Deletes old CNAME record (if exists)
   - Creates new CNAME: `www.choredomino.com` → `happy-hill-05779860f.2.azurestaticapps.net`
   - TTL: 600 seconds (10 minutes)

4. **Configures apex domain forwarding**
   - Deletes old URL forward (if exists)
   - Creates 301 redirect: `choredomino.com` → `https://www.choredomino.com`
   - Includes path: yes (preserves URLs)

5. **Waits for DNS propagation**
   - Polls DNS for up to 20 attempts (3+ minutes)
   - Verifies CNAME is resolvable
   - Continues even if not fully propagated

6. **Adds custom domain to Azure**
   - Configures `www.choredomino.com` in Azure Static Web App
   - Azure begins domain validation
   - Azure provisions free SSL certificate automatically

7. **Verifies domain validation**
   - Checks status up to 5 times (1+ minutes)
   - Reports "Ready" when successful
   - Reports "In Progress" if still validating

## Expected Timeline

- **DNS Creation**: Instant via Porkbun API
- **DNS Propagation**: 10 minutes to 48 hours (usually 10-30 minutes)
- **Azure Validation**: 5-60 minutes after DNS propagates
- **SSL Certificate**: Automatic, 5-10 minutes after validation

## Verification Commands

```bash
# Check DNS propagation
nslookup www.choredomino.com 8.8.8.8

# Check Azure custom domain status
az staticwebapp hostname show \
  --name choredomino \
  --resource-group choredomino_group \
  --hostname www.choredomino.com \
  --query "status" \
  -o tsv

# List all custom domains
az staticwebapp hostname list \
  --name choredomino \
  --resource-group choredomino_group \
  -o table
```

## Troubleshooting

### DNS not propagating
- Wait 10-15 minutes
- Check Porkbun dashboard: https://porkbun.com/account/domainsSpeedy
- Clear local DNS cache: `sudo systemd-resolve --flush-caches` (Linux)

### Azure validation stuck
- Verify DNS CNAME is correct: `nslookup www.choredomino.com`
- Check Azure Portal: Static Web Apps → Custom domains
- Domain validation can take up to 48 hours
- Azure retries validation automatically

### SSL certificate not provisioning
- Azure provides free SSL automatically
- Provisioning happens after domain validation
- Check Azure Portal for certificate status
- Can take 5-10 minutes after validation

## Required GitHub Secrets

These must be configured in GitHub Settings → Secrets:

- ✅ `AZURE_CREDENTIALS` - Service principal JSON
- ✅ `AZURE_STATIC_WEB_APP_NAME` - `choredomino`
- ✅ `AZURE_RESOURCE_GROUP` - `choredomino_group`
- ✅ `PORKBUN_API_KEY` - API key from Porkbun
- ✅ `PORKBUN_SECRET_KEY` - Secret key from Porkbun

All secrets are already configured and verified.

## Post-Configuration

After the workflow completes successfully:

1. **Wait for DNS propagation** (10-30 minutes typically)
2. **Verify the site loads**:
   - https://www.choredomino.com (should load your app)
   - http://choredomino.com (should redirect to www)
   - https://choredomino.com (should redirect to www)

3. **Test SSL certificate**:
   ```bash
   curl -I https://www.choredomino.com | grep -i "strict-transport"
   ```

4. **Update README with custom domain**

## Notes

- The workflow is **idempotent** - safe to run multiple times
- It checks current state and skips unnecessary updates
- DNS changes are atomic (delete then create)
- Azure SSL is free and renews automatically
- TTL is 600s (10 min) for faster updates during testing
