# GitHub Secrets Setup Guide

This document explains how to configure the required GitHub secrets for the workflows.

## Required Secrets

### `ENDPOINTS_JSON`

**Used by:** `build-extension.yml`  
**Purpose:** Contains the API endpoints configuration for the browser extension

**How to set it up:**

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Set the name as: `ENDPOINTS_JSON`
5. Copy the contents of your local `browser-ext/endpoints.json` file
6. Paste it into the secret value field
7. Click **Add secret**

**Expected format:**
```json
[{
    "name": "PROD",
    "importUrl": "https://your-prod-endpoint.azurewebsites.net/api/LinkedIn/JsonResumeToAirtable?code=YOUR_CODE",
    "checkUrl": "https://your-prod-endpoint.azurewebsites.net/api/LinkedIn/DoesProfileExist?code=YOUR_CODE"
},{
    "name": "DEV",
    "importUrl": "https://your-dev-endpoint.azurewebsites.net/api/LinkedIn/JsonResumeToAirtable?code=YOUR_CODE",
    "checkUrl": "https://your-dev-endpoint.azurewebsites.net/api/LinkedIn/DoesProfileExist?code=YOUR_CODE"
}]
```

**Note:** Make sure to copy the entire JSON array, including the square brackets.

---

## Optional Secrets

### `CODECOV_TOKEN`

**Used by:** `test.yml`  
**Purpose:** Uploads test coverage reports to Codecov (optional)

**How to set it up:**

1. Sign up at [codecov.io](https://codecov.io) and link your repository
2. Get your upload token from Codecov
3. Add it as a GitHub secret named `CODECOV_TOKEN`

If not set, the workflow will continue but won't upload coverage (due to `continue-on-error: true`).

---

## Verifying Secrets

### Test the Build Workflow

After adding `ENDPOINTS_JSON`:

1. Go to **Actions** tab
2. Select **Build Browser Extension** workflow  
3. Click **Run workflow**
4. Select your branch
5. Click **Run workflow**

The build should complete successfully and create the extension zip file.

### Check for Errors

If the workflow fails with "endpoints.json was not created":
- Verify the secret name is exactly `ENDPOINTS_JSON` (case-sensitive)
- Check that the secret value is valid JSON
- Ensure there are no extra spaces or newlines before/after the JSON

---

## Security Best Practices

### ✅ DO:
- Store all sensitive URLs and access codes in secrets
- Rotate access codes periodically
- Use separate DEV and PROD endpoints
- Review who has access to repository secrets

### ❌ DON'T:
- Commit `endpoints.json` to the repository
- Share secret values in issues or PRs
- Use production secrets for testing
- Log secret values in workflows (they're automatically masked)

---

## Updating Secrets

When you need to update endpoint URLs or access codes:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Find `ENDPOINTS_JSON` in the list
3. Click **Update**
4. Paste the new JSON content
5. Click **Update secret**

The next workflow run will use the updated values.

---

## Local Development

For local development, you still need your local `browser-ext/endpoints.json` file:

```bash
# Copy the example file
cp browser-ext/endpoints-example.json browser-ext/endpoints.json

# Edit with your own endpoints
# This file is gitignored and won't be committed
```

---

## Troubleshooting

### Workflow fails with "endpoints.json not found"

**Cause:** The secret is not set or has wrong name  
**Fix:** Double-check secret name is `ENDPOINTS_JSON` (exact match)

### Extension builds but endpoints don't work

**Cause:** Invalid JSON in the secret  
**Fix:** Validate your JSON at [jsonlint.com](https://jsonlint.com) before adding as secret

### Can't find where to add secrets

**Cause:** May need admin/write permissions  
**Fix:** Ask a repository admin to add the secret or grant you permissions

---

## Example: Adding the Secret via GitHub CLI

If you prefer using the command line:

```bash
# Install GitHub CLI: https://cli.github.com

# Login to GitHub
gh auth login

# Add the secret (will prompt for value)
gh secret set ENDPOINTS_JSON < browser-ext/endpoints.json

# Verify it was added
gh secret list
```

---

For more information about GitHub Secrets, see:
- [GitHub Docs: Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [GitHub Docs: Using Secrets in Workflows](https://docs.github.com/en/actions/security-guides/encrypted-secrets#using-encrypted-secrets-in-a-workflow)

