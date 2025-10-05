# LinkedIn Profile Extraction Diagnostic Guide

## Overview

As of late 2024, LinkedIn deprecated the `profileView` endpoint (`/identity/profiles/{profileId}/profileView`), which returned HTTP 410 Gone. This diagnostic guide helps you test which data extraction methods still work with your LinkedIn profile.

## Quick Diagnostic

### Step 1: Load the Diagnostic Script

1. Navigate to a LinkedIn profile page (preferably your own): `https://www.linkedin.com/in/your-profile/`
2. Open your browser's developer console:
   - **Chrome/Edge**: Press `F12` or `Ctrl+Shift+J` (Windows) / `Cmd+Option+J` (Mac)
   - **Firefox**: Press `F12` or `Ctrl+Shift+K` (Windows) / `Cmd+Option+K` (Mac)
3. Copy the entire contents of `src/diagnostic.js` and paste into the console
4. Press Enter to load the diagnostic tool

### Step 2: Run the Diagnostic

Run the comprehensive diagnostic:
```javascript
await LinkedInDiagnostic.runFullDiagnostic()
```

Or run a quick test:
```javascript
await LinkedInDiagnostic.quickTest()
```

### Step 3: Review Results

The diagnostic will test:
- ✅ **API Endpoints**: Which LinkedIn Voyager API endpoints still work
- ✅ **DOM Extraction**: Whether profile data is embedded in the page
- ✅ **Data Completeness**: What information can be extracted from each source

## Understanding the Results

### API Endpoint Status

| Endpoint | Expected Status | Notes |
|----------|----------------|-------|
| `profileView` | ❌ 410 Gone | Deprecated by LinkedIn |
| `dashFullProfile` | ✅ 200 OK | **Primary data source** |
| `profileContactInfo` | ✅ 200 OK | Email, phone, websites |
| `profileSkills` | ✅ 200 OK | Full skills list |
| `recommendations` | ✅ 200 OK | Recommendations received |

### DOM Extraction Methods

| Method | Description | Reliability |
|--------|-------------|-------------|
| **Embedded JSON Schema** | JSON data in `<code>` tags | High (if present) |
| **Profile Picture** | Image URL from DOM | High |
| **Skill Elements** | Skills from HTML elements | Medium |

## What the Plugin Now Does

The plugin has been updated with the following improvements:

### 1. **Automatic Endpoint Switching**
- **Primary**: Uses `dashFullProfile` endpoint by default
- **Fallback**: Attempts `profileView` if Dash fails (for future compatibility)
- **Last Resort**: Extracts from embedded DOM schema

### 2. **Better Error Handling**
- Detects 410 errors specifically
- Provides helpful error messages
- Logs which methods are being attempted

### 3. **Enhanced Embedded Schema Extraction**
- More lenient detection of profile data
- Tries multiple schema blocks if first fails
- Better error recovery

## Troubleshooting

### Problem: "Could not find CSRF token"
**Solution**: Make sure you're logged into LinkedIn and refresh the page.

### Problem: "Not on a LinkedIn profile page"
**Solution**: Navigate to a profile page URL like `https://www.linkedin.com/in/username/`

### Problem: All API endpoints return errors
**Solution**: 
1. Check if you're logged into LinkedIn
2. Try refreshing the page
3. Check browser console for CORS or network errors
4. LinkedIn might be rate-limiting your requests - wait a few minutes

### Problem: No embedded schema blocks found
**Solution**: 
1. Refresh the page to ensure LinkedIn has loaded all data
2. Scroll down to trigger lazy-loaded content
3. Some profiles might not have complete embedded data

## Testing the Fixed Plugin

After implementing the fixes, test with:

### Test 1: Your Own Profile
```javascript
// 1. Navigate to your profile
// 2. Run the extension
// 3. Verify all sections are extracted:
//    - Basic info (name, headline, location)
//    - Work history
//    - Education
//    - Skills
//    - Certifications
//    - Languages
```

### Test 2: Another User's Profile
```javascript
// 1. Navigate to a colleague's profile
// 2. Run the extension
// 3. Verify data extraction (some data may be limited by privacy settings)
```

### Test 3: Profile with Multilingual Support
```javascript
// 1. Find a profile with multiple language versions
// 2. Test extraction in different languages
// 3. Verify language selector in extension popup works
```

## Advanced Diagnostic Commands

### Test Specific Endpoint
```javascript
const result = await LinkedInDiagnostic.testEndpoint(
    'dashProfile',
    '/identity/dash/profiles?q=memberIdentity&memberIdentity=YOUR_PROFILE_ID&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93',
    'Dash endpoint test'
);
console.log(result);
```

### Test DOM Extraction Only
```javascript
const domResults = LinkedInDiagnostic.testDOMExtraction();
console.log(domResults);
```

### Get Current Profile ID
```javascript
const profileId = LinkedInDiagnostic.getProfileId();
console.log('Current profile ID:', profileId);
```

## What Changed in the Fix

### Before (Broken)
```javascript
// Always tried profileView first
profileResponse = await this.voyagerFetch(_voyagerEndpoints.fullProfileView);
// Result: 410 Gone error, plugin fails
```

### After (Fixed)
```javascript
// Try Dash endpoint first
try {
    profileResponse = await this.voyagerFetch(_voyagerEndpoints.dash.fullProfile.path);
} catch (dashError) {
    // Fallback to profileView (for future compatibility)
    try {
        profileResponse = await this.voyagerFetch(_voyagerEndpoints.fullProfileView);
    } catch (profileViewError) {
        // Try embedded schema
        await this.parseEmbeddedLiSchema();
    }
}
```

## Reporting Issues

If the diagnostic reveals issues not covered here:

1. **Save the diagnostic results**:
   ```javascript
   const results = await LinkedInDiagnostic.runFullDiagnostic();
   console.log(JSON.stringify(results, null, 2));
   // Copy this output
   ```

2. **Check browser console** for any error messages

3. **Note your environment**:
   - Browser and version
   - LinkedIn profile language/locale
   - Whether it's your own profile or someone else's

4. **Open an issue** with:
   - Diagnostic results
   - Console errors
   - Environment details
   - What you were trying to do

## Next Steps

After running diagnostics:

1. If **dashFullProfile works**: ✅ The plugin should work with the new updates
2. If **embedded schema has data**: ✅ The plugin has a fallback that should work
3. If **nothing works**: ⚠️ LinkedIn may have changed their structure significantly - report the issue

## Related Files

- `src/diagnostic.js` - The diagnostic script
- `src/main.js` - Updated plugin with new endpoint logic
- `docs/LinkedIn-Dev-Notes-README.md` - Technical notes about LinkedIn's API

