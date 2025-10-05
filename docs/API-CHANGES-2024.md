# LinkedIn API Changes - October 2024

## Summary

LinkedIn deprecated **multiple profile-related endpoints** in late 2024, returning HTTP 410 Gone for requests to:
```
/identity/profiles/{profileId}/profileView
/identity/profiles/{profileId}/profileContactInfo
/identity/profiles/{profileId}/skillCategory
```

The `profileView` endpoint was the primary method this extension used to extract profile data, while `profileContactInfo` and `skillCategory` were used for supplementary data.

## Impact

### What Stopped Working
- ❌ Primary profile data extraction via `profileView` endpoint
- ❌ Contact info extraction via `profileContactInfo` endpoint (email, phone, websites)
- ❌ Full skills list via `skillCategory` endpoint
- ❌ Direct profile URN ID extraction from `profileView`
- ❌ Certain fallback paths that depended on these endpoints

### What Still Works
- ✅ Dash endpoint: `/identity/dash/profiles?q=memberIdentity&memberIdentity={profileId}&decorationId=...` **(Primary data source)**
- ✅ Recommendations endpoint: `/identity/profiles/{profileId}/recommendations`
- ✅ Work history endpoint: `/identity/dash/profilePositionGroups`
- ✅ Volunteer endpoint: `/identity/dash/profileVolunteerExperiences`
- ✅ Embedded JSON schema in DOM (`<code id^="bpr-guid-">` elements)
- ✅ Profile picture extraction from DOM

## Technical Details

### Old Endpoint (Deprecated)
```javascript
// This now returns 410 Gone
GET /voyager/api/identity/profiles/{profileId}/profileView
Headers:
  - csrf-token: {JSESSIONID}
  - accept: application/vnd.linkedin.normalized+json+2.1

Response: 410 Gone
{
  "message": "This resource is gone",
  "status": 410
}
```

### New Primary Endpoint
```javascript
// This still works
GET /voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity={profileId}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93
Headers:
  - csrf-token: {JSESSIONID}
  - accept: application/vnd.linkedin.normalized+json+2.1

Response: 200 OK
{
  "data": {
    "$type": "com.linkedin.restli.common.CollectionResponse",
    "*elements": ["urn:li:fsd_profile:..."],
    ...
  },
  "included": [...]
}
```

## Code Changes Made

### 1. Switched Primary Endpoint

**File**: `src/main.js` (Line ~1408-1432)

**Before**:
```javascript
let endpointType = 'profileView';
if (!localeMatchesUser || this.preferDash === true) {
    endpointType = 'dashFullProfileWithEntities';
    profileResponse = await this.voyagerFetch(_voyagerEndpoints.dash.fullProfile.path);
} else {
    profileResponse = await this.voyagerFetch(_voyagerEndpoints.fullProfileView);
}
```

**After**:
```javascript
let endpointType = 'dashFullProfileWithEntities';
try {
    // Try Dash endpoint first (profileView returns 410)
    profileResponse = await this.voyagerFetch(_voyagerEndpoints.dash.fullProfile.path);
} catch (dashError) {
    // Fallback to profileView (kept for backward compatibility)
    try {
        endpointType = 'profileView';
        profileResponse = await this.voyagerFetch(_voyagerEndpoints.fullProfileView);
    } catch (profileViewError) {
        throw new Error('Could not fetch profile data from any API endpoint');
    }
}
```

### 2. Enhanced Error Handling

**File**: `src/main.js` (Line ~1941-1950)

**Added specific 410 handling**:
```javascript
if (response.status === 410) {
    const errStr = `LinkedIn API endpoint deprecated (410 Gone): ${endpoint}`;
    console.warn(errStr);
    _this.debugConsole.warn(errStr, 'This endpoint is no longer available. The plugin will try alternative methods.');
    reject(new Error(errStr));
}
```

### 3. Improved Embedded Schema Extraction

**File**: `src/main.js` (Line ~869-935)

**Enhancements**:
- More lenient detection patterns
- Better error recovery
- Tries multiple schema blocks
- More detailed logging

### 4. Updated Profile URN ID Extraction

**File**: `src/main.js` (Line ~1748-1775)

**Now tries Dash endpoint first** before falling back to `profileView`.

### 5. Better Fallback Chain

**File**: `src/main.js` (Line ~1506-1535)

**Execution order**:
1. Try Dash API endpoint (primary)
2. Try embedded schema (fallback)
3. Show helpful error if both fail

## Data Structure Differences

### profileView Response Structure
```javascript
{
  "data": {
    "$type": "com.linkedin.voyager.identity.profile.ProfileView",
    "entityUrn": "urn:li:fs_profileView:...",
    "*profile": "urn:li:fs_profile:...",
    "*positionGroupView": "urn:li:fs_profilePositionGroup:...",
    ...
  },
  "included": [...]
}
```

### Dash Profile Response Structure
```javascript
{
  "data": {
    "$type": "com.linkedin.restli.common.CollectionResponse",
    "*elements": ["urn:li:fsd_profile:..."],
    "paging": {...}
  },
  "included": [
    {
      "$type": "com.linkedin.voyager.dash.identity.profile.Profile",
      "entityUrn": "urn:li:fsd_profile:...",
      "firstName": "...",
      "lastName": "...",
      "*profileEducations": "urn:li:...",
      "*profilePositionGroups": "urn:li:...",
      ...
    },
    ...
  ]
}
```

**Key differences**:
- Dash uses `*elements` array instead of direct URN references
- Profile data is nested differently in `included` array
- Some field names differ (`primaryLocale` vs `defaultLocale`)
- Table of Contents structure is different

## Parser Compatibility

The existing `parseProfileSchemaJSON()` function handles both formats:

```javascript
async function parseProfileSchemaJSON(instance, liResponse, endpoint = 'profileView') {
    const dash = endpoint === 'dashFullProfileWithEntities';
    
    if (dash && !liResponse.data.hoisted) {
        // Special handling for Dash endpoint
        const profileObj = db.getElementByUrn(db.tableOfContents['*elements'][0]);
        // Hoist profile data to root level for consistent parsing
        const hoistedRes = {
            data: { ...liResponse.data, ...profileObj, hoisted: true },
            included: liResponse.included
        };
        db = buildDbFromLiSchema(hoistedRes);
    }
    
    // Continue with standard parsing...
}
```

## Testing the Changes

### Manual Test
1. Navigate to a LinkedIn profile
2. Open browser console
3. Run:
   ```javascript
   // Test Dash endpoint
   const response = await fetch(
       'https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=YOUR_PROFILE_ID&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93',
       {
           headers: {
               'csrf-token': document.cookie.match(/JSESSIONID="(.+?)"/)[1],
               'accept': 'application/vnd.linkedin.normalized+json+2.1'
           }
       }
   );
   console.log(response.status); // Should be 200
   ```

### Using Diagnostic Script
```javascript
// Load diagnostic.js then run:
const results = await LinkedInDiagnostic.runFullDiagnostic();
console.log(results.summary);
```

## Migration Checklist

If you're maintaining a fork or similar tool:

- [ ] Update primary endpoint to Dash
- [ ] Add 410 error handling
- [ ] Implement fallback to embedded schema
- [ ] Test with multiple profile types
- [ ] Update documentation
- [ ] Handle different response structures
- [ ] Test multilingual profiles
- [ ] Verify all data sections extract correctly

## Future Considerations

### Potential Further Changes
LinkedIn may continue to evolve their API. Monitor for:
- Changes to Dash endpoint structure
- New decorationId requirements
- CSRF token validation changes
- Rate limiting adjustments
- GraphQL migration (LinkedIn has been slowly moving to GraphQL)

### Resilience Strategies
1. **Multiple data sources**: Always have fallbacks (API → DOM → manual)
2. **Flexible parsing**: Don't hardcode field names
3. **Graceful degradation**: Extract what you can, note what failed
4. **Version detection**: Check response structure before parsing
5. **Comprehensive logging**: Help users debug issues

## References

- [LinkedIn Voyager API docs](https://docs.microsoft.com/en-us/linkedin/shared/api-guide/concepts/)
- [JSON Resume Schema](https://jsonresume.org/schema/)
- Original extension: [joshuatz/linkedin-to-jsonresume](https://github.com/joshuatz/linkedin-to-jsonresume)

## Timeline

- **October 2024**: `profileView` endpoint starts returning 410 Gone
- **October 2024**: Fix implemented to use Dash endpoint as primary
- **Future**: Monitor for further API changes

## Questions?

See [DIAGNOSTIC-GUIDE.md](./DIAGNOSTIC-GUIDE.md) for troubleshooting steps.

