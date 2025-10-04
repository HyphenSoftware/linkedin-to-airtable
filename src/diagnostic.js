/**
 * LinkedIn Profile Data Extraction Diagnostic Tool
 * 
 * This script tests various methods of extracting LinkedIn profile data
 * to determine which endpoints and techniques still work after API changes.
 * 
 * Usage:
 * 1. Navigate to a LinkedIn profile page (e.g., https://www.linkedin.com/in/your-profile/)
 * 2. Open browser console (F12)
 * 3. Copy and paste this entire script
 * 4. Run: await LinkedInDiagnostic.runFullDiagnostic()
 * 5. Review the results object that is returned and logged
 */

window.LinkedInDiagnostic = (() => {
    const VOYAGER_BASE = 'https://www.linkedin.com/voyager/api';
    
    /**
     * Get CSRF token from cookies
     */
    function getCookie(name) {
        const v = document.cookie.match(`(^|;) ?${name}=([^;]*)(;|$)`);
        return v ? v[2] : null;
    }
    
    /**
     * Get the profile ID from the current URL
     */
    function getProfileId() {
        const linkedProfileRegUrl = /linkedin.com\/in\/([^\/?#]+)[\/?#]?.*$/im;
        if (linkedProfileRegUrl.test(document.location.href)) {
            return linkedProfileRegUrl.exec(document.location.href)[1];
        }
        return null;
    }
    
    /**
     * Make a fetch request to LinkedIn Voyager API
     */
    async function voyagerFetch(endpoint, headers = {}) {
        const csrfToken = getCookie('JSESSIONID')?.replace(/"/g, '');
        
        if (!csrfToken) {
            throw new Error('Could not find CSRF token (JSESSIONID cookie)');
        }
        
        const fullUrl = endpoint.startsWith('http') ? endpoint : VOYAGER_BASE + endpoint;
        
        const response = await fetch(fullUrl, {
            credentials: 'include',
            headers: {
                ...headers,
                'accept': 'application/vnd.linkedin.normalized+json+2.1',
                'csrf-token': csrfToken,
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin'
            },
            referrer: document.location.href,
            method: 'GET',
            mode: 'cors'
        });
        
        return {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            data: response.ok ? await response.json() : null,
            error: !response.ok ? await response.text() : null
        };
    }
    
    /**
     * Test a specific endpoint
     */
    async function testEndpoint(name, endpoint, description) {
        console.log(`Testing ${name}...`);
        try {
            const result = await voyagerFetch(endpoint);
            const success = result.ok;
            
            return {
                name,
                description,
                endpoint,
                success,
                status: result.status,
                statusText: result.statusText,
                hasData: success && result.data?.included?.length > 0,
                dataPreview: success ? {
                    includedCount: result.data?.included?.length || 0,
                    dataKeys: Object.keys(result.data?.data || {}),
                    dataType: result.data?.data?.$type
                } : null,
                error: result.error,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                name,
                description,
                endpoint,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    /**
     * Test DOM-based data extraction
     */
    function testDOMExtraction() {
        console.log('Testing DOM extraction methods...');
        
        const results = {
            embeddedSchemaBlocks: {
                description: 'JSON data embedded in <code> tags',
                found: false,
                count: 0,
                hasProfileData: false,
                details: null
            },
            profilePicture: {
                description: 'Profile picture extraction from DOM',
                found: false,
                url: null
            },
            skillElements: {
                description: 'Skill names from DOM elements',
                found: false,
                count: 0,
                skills: []
            },
            metaTags: {
                description: 'Useful meta tags',
                found: false,
                tags: {}
            }
        };
        
        // Test embedded schema blocks
        const codeBlocks = document.querySelectorAll('code[id^="bpr-guid-"]');
        results.embeddedSchemaBlocks.count = codeBlocks.length;
        results.embeddedSchemaBlocks.found = codeBlocks.length > 0;
        
        if (codeBlocks.length > 0) {
            let profileDataFound = false;
            const blockDetails = [];
            
            codeBlocks.forEach((block, idx) => {
                try {
                    const json = JSON.parse(block.innerHTML);
                    const hasEducation = /educationView/.test(block.innerHTML);
                    const hasPosition = /positionView/.test(block.innerHTML);
                    const hasProfile = /profile/.test(block.innerHTML);
                    
                    blockDetails.push({
                        index: idx,
                        hasEducation,
                        hasPosition,
                        hasProfile,
                        dataType: json.data?.$type,
                        includedCount: json.included?.length || 0,
                        dataKeys: Object.keys(json.data || {})
                    });
                    
                    if (hasEducation && hasPosition) {
                        profileDataFound = true;
                    }
                } catch (e) {
                    blockDetails.push({
                        index: idx,
                        error: 'Failed to parse JSON'
                    });
                }
            });
            
            results.embeddedSchemaBlocks.hasProfileData = profileDataFound;
            results.embeddedSchemaBlocks.details = blockDetails;
        }
        
        // Test profile picture
        let imgElement = document.querySelector('img[class*="profile-picture"]');
        if (!imgElement) {
            imgElement = document.querySelector('img[class*="profile-photo"]');
        }
        if (imgElement && imgElement.src) {
            results.profilePicture.found = true;
            results.profilePicture.url = imgElement.src;
        }
        
        // Test skill elements
        const skillElements = document.querySelectorAll('span[class*="skill-category-entity"][class*="name"]');
        if (skillElements.length > 0) {
            results.skillElements.found = true;
            results.skillElements.count = skillElements.length;
            skillElements.forEach(elem => {
                results.skillElements.skills.push(elem.innerText);
            });
        }
        
        // Test meta tags
        const metaLocale = document.querySelector('meta[name="i18nDefaultLocale"]');
        if (metaLocale) {
            results.metaTags.found = true;
            results.metaTags.tags.locale = metaLocale.getAttribute('content');
        }
        
        return results;
    }
    
    /**
     * Run comprehensive diagnostic
     */
    async function runFullDiagnostic() {
        console.log('=== LinkedIn Profile Data Extraction Diagnostic ===\n');
        
        const profileId = getProfileId();
        if (!profileId) {
            console.error('Could not extract profile ID from URL. Make sure you are on a LinkedIn profile page.');
            return null;
        }
        
        console.log(`Profile ID: ${profileId}\n`);
        
        const diagnostic = {
            profileId,
            timestamp: new Date().toISOString(),
            apiEndpoints: {},
            domExtraction: {},
            summary: {
                workingEndpoints: [],
                brokenEndpoints: [],
                domMethodsAvailable: []
            }
        };
        
        // Test all API endpoints
        console.log('\n--- Testing API Endpoints ---\n');
        
        const endpointsToTest = [
            {
                name: 'profileView (OLD)',
                endpoint: `/identity/profiles/${profileId}/profileView`,
                description: 'Original full profile endpoint (likely 410 Gone)'
            },
            {
                name: 'dashFullProfile',
                endpoint: `/identity/dash/profiles?q=memberIdentity&memberIdentity=${profileId}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93`,
                description: 'Dash full profile endpoint (alternative to profileView)'
            },
            {
                name: 'profileContactInfo',
                endpoint: `/identity/profiles/${profileId}/profileContactInfo`,
                description: 'Contact information (email, phone, websites)'
            },
            {
                name: 'profileSkills',
                endpoint: `/identity/profiles/${profileId}/skillCategory`,
                description: 'Full skills list'
            },
            {
                name: 'recommendations',
                endpoint: `/identity/profiles/${profileId}/recommendations?q=received&recommendationStatuses=List(VISIBLE)`,
                description: 'Recommendations received'
            }
        ];
        
        // Note: These require profileUrnId which we can't easily get without a working profile endpoint
        console.log('Note: Some endpoints require profileUrnId and will be tested with placeholder\n');
        
        for (const endpointDef of endpointsToTest) {
            const result = await testEndpoint(
                endpointDef.name,
                endpointDef.endpoint,
                endpointDef.description
            );
            
            diagnostic.apiEndpoints[endpointDef.name] = result;
            
            if (result.success) {
                diagnostic.summary.workingEndpoints.push(endpointDef.name);
                console.log(`✓ ${endpointDef.name}: SUCCESS (${result.status})`);
            } else {
                diagnostic.summary.brokenEndpoints.push(endpointDef.name);
                console.log(`✗ ${endpointDef.name}: FAILED (${result.status} ${result.statusText})`);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Test DOM extraction
        console.log('\n--- Testing DOM Extraction ---\n');
        diagnostic.domExtraction = testDOMExtraction();
        
        // Summarize DOM results
        if (diagnostic.domExtraction.embeddedSchemaBlocks.found) {
            diagnostic.summary.domMethodsAvailable.push('Embedded JSON Schema');
            console.log(`✓ Embedded Schema Blocks: ${diagnostic.domExtraction.embeddedSchemaBlocks.count} found`);
            console.log(`  Has full profile data: ${diagnostic.domExtraction.embeddedSchemaBlocks.hasProfileData ? 'YES' : 'NO'}`);
        } else {
            console.log('✗ Embedded Schema Blocks: Not found');
        }
        
        if (diagnostic.domExtraction.profilePicture.found) {
            diagnostic.summary.domMethodsAvailable.push('Profile Picture');
            console.log('✓ Profile Picture: Found');
        } else {
            console.log('✗ Profile Picture: Not found');
        }
        
        if (diagnostic.domExtraction.skillElements.found) {
            diagnostic.summary.domMethodsAvailable.push('Skill DOM Elements');
            console.log(`✓ Skill Elements: ${diagnostic.domExtraction.skillElements.count} found`);
        } else {
            console.log('✗ Skill Elements: Not found');
        }
        
        // Print summary
        console.log('\n=== SUMMARY ===\n');
        console.log(`Working API Endpoints (${diagnostic.summary.workingEndpoints.length}):`);
        diagnostic.summary.workingEndpoints.forEach(name => console.log(`  ✓ ${name}`));
        
        console.log(`\nBroken API Endpoints (${diagnostic.summary.brokenEndpoints.length}):`);
        diagnostic.summary.brokenEndpoints.forEach(name => console.log(`  ✗ ${name}`));
        
        console.log(`\nAvailable DOM Methods (${diagnostic.summary.domMethodsAvailable.length}):`);
        diagnostic.summary.domMethodsAvailable.forEach(method => console.log(`  ✓ ${method}`));
        
        console.log('\n=== RECOMMENDATIONS ===\n');
        
        if (diagnostic.summary.workingEndpoints.includes('dashFullProfile')) {
            console.log('✓ RECOMMENDED: Use dashFullProfile endpoint as primary data source');
        } else if (diagnostic.domExtraction.embeddedSchemaBlocks.hasProfileData) {
            console.log('✓ RECOMMENDED: Use embedded schema extraction as primary method');
        } else {
            console.log('⚠ WARNING: No reliable data source found. May need to use multiple fallback methods.');
        }
        
        console.log('\nFull diagnostic results stored in returned object.');
        return diagnostic;
    }
    
    /**
     * Quick test - just check critical endpoints
     */
    async function quickTest() {
        const profileId = getProfileId();
        if (!profileId) {
            console.error('Not on a LinkedIn profile page');
            return null;
        }
        
        console.log('Running quick diagnostic...\n');
        
        const tests = {
            profileView: await testEndpoint(
                'profileView',
                `/identity/profiles/${profileId}/profileView`,
                'Old endpoint'
            ),
            dashProfile: await testEndpoint(
                'dashProfile',
                `/identity/dash/profiles?q=memberIdentity&memberIdentity=${profileId}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93`,
                'Dash endpoint'
            ),
            embeddedSchema: testDOMExtraction().embeddedSchemaBlocks
        };
        
        console.log('Results:');
        console.log(`profileView: ${tests.profileView.success ? '✓' : '✗'} (${tests.profileView.status})`);
        console.log(`dashProfile: ${tests.dashProfile.success ? '✓' : '✗'} (${tests.dashProfile.status})`);
        console.log(`embeddedSchema: ${tests.embeddedSchema.hasProfileData ? '✓' : '✗'} (${tests.embeddedSchema.count} blocks)`);
        
        return tests;
    }
    
    // Public API
    return {
        runFullDiagnostic,
        quickTest,
        testEndpoint,
        testDOMExtraction,
        getProfileId,
        getCookie
    };
})();

// Auto-run message
console.log('LinkedIn Diagnostic Tool loaded!');
console.log('Run: await LinkedInDiagnostic.runFullDiagnostic()');
console.log('Or: await LinkedInDiagnostic.quickTest()');

