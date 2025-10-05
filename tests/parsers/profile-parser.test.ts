import {
    parseProfileBasics,
    parseProfileLanguage,
    buildLinkedInProfileUrl,
    addSocialProfile,
    parseFullName,
    validateBasics,
    mergeBasics,
    sanitizeBasics,
    LiProfile,
    ResumeBasicsLegacy
} from '../../src/parsers/profile-parser';

describe('Profile/Basics Parser', () => {
    describe('parseProfileBasics', () => {
        it('should parse basic profile information', () => {
            const profile: LiProfile = {
                firstName: 'John',
                lastName: 'Doe',
                headline: 'Software Engineer',
                summary: 'Experienced developer with 10 years in the industry',
                defaultLocale: {
                    country: 'US',
                    language: 'en'
                }
            };

            const result = parseProfileBasics(profile, false);

            expect(result.legacy.name).toBe('John Doe');
            expect(result.legacy.label).toBe('Software Engineer');
            expect(result.legacy.summary).toBe('Experienced developer with 10 years in the industry');
            expect(result.legacy.location.countryCode).toBe('US');
            expect(result.locale).toBe('en_US');
        });

        it('should use primaryLocale when useDashFormat is true', () => {
            const profile: LiProfile = {
                firstName: 'Jane',
                lastName: 'Smith',
                primaryLocale: {
                    country: 'GB',
                    language: 'en'
                },
                defaultLocale: {
                    country: 'US',
                    language: 'en'
                }
            };

            const result = parseProfileBasics(profile, true);

            expect(result.legacy.location.countryCode).toBe('GB');
            expect(result.locale).toBe('en_GB');
        });

        it('should use defaultLocale when useDashFormat is false', () => {
            const profile: LiProfile = {
                firstName: 'Jane',
                lastName: 'Smith',
                primaryLocale: {
                    country: 'GB',
                    language: 'en'
                },
                defaultLocale: {
                    country: 'US',
                    language: 'en'
                }
            };

            const result = parseProfileBasics(profile, false);

            expect(result.legacy.location.countryCode).toBe('US');
            expect(result.locale).toBe('en_US');
        });

        it('should handle address field', () => {
            const profile: LiProfile = {
                firstName: 'John',
                lastName: 'Doe',
                address: 'San Francisco, CA',
                defaultLocale: { country: 'US', language: 'en' }
            };

            const result = parseProfileBasics(profile);

            expect(result.legacy.location.address).toBe('San Francisco, CA');
        });

        it('should prefer address over locationName', () => {
            const profile: LiProfile = {
                firstName: 'John',
                lastName: 'Doe',
                address: 'San Francisco, CA',
                locationName: 'California',
                defaultLocale: { country: 'US', language: 'en' }
            };

            const result = parseProfileBasics(profile);

            expect(result.legacy.location.address).toBe('San Francisco, CA');
        });

        it('should use locationName if address is not available', () => {
            const profile: LiProfile = {
                firstName: 'John',
                lastName: 'Doe',
                locationName: 'California',
                defaultLocale: { country: 'US', language: 'en' }
            };

            const result = parseProfileBasics(profile);

            expect(result.legacy.location.address).toBe('California');
        });

        it('should handle missing name fields', () => {
            const profile: LiProfile = {
                defaultLocale: { country: 'US', language: 'en' }
            };

            const result = parseProfileBasics(profile);

            expect(result.legacy.name).toBe('');
        });

        it('should handle partial name', () => {
            const profile: LiProfile = {
                firstName: 'John',
                defaultLocale: { country: 'US', language: 'en' }
            };

            const result = parseProfileBasics(profile);

            expect(result.legacy.name).toBe('John');
        });

        it('should initialize empty profiles array', () => {
            const profile: LiProfile = {
                firstName: 'John',
                lastName: 'Doe',
                defaultLocale: { country: 'US', language: 'en' }
            };

            const result = parseProfileBasics(profile);

            expect(result.legacy.profiles).toEqual([]);
            expect(result.stable.profiles).toEqual([]);
        });

        it('should handle missing locale', () => {
            const profile: LiProfile = {
                firstName: 'John',
                lastName: 'Doe'
            };

            const result = parseProfileBasics(profile);

            expect(result.legacy.location.countryCode).toBe('');
            expect(result.locale).toBe('en_US'); // Default fallback
        });
    });

    describe('parseProfileLanguage', () => {
        it('should parse English language', () => {
            const profile: LiProfile = {
                defaultLocale: {
                    country: 'US',
                    language: 'en'
                }
            };

            const result = parseProfileLanguage(profile);

            expect(result.language).toBe('English');
            expect(result.fluency).toBe('Native Speaker');
        });

        it('should parse non-English language', () => {
            const profile: LiProfile = {
                defaultLocale: {
                    country: 'FR',
                    language: 'French'
                }
            };

            const result = parseProfileLanguage(profile);

            expect(result.language).toBe('French');
            expect(result.fluency).toBe('Native Speaker');
        });

        it('should use primaryLocale when useDashFormat is true', () => {
            const profile: LiProfile = {
                primaryLocale: {
                    country: 'DE',
                    language: 'de'
                },
                defaultLocale: {
                    country: 'US',
                    language: 'en'
                }
            };

            const result = parseProfileLanguage(profile, true);

            expect(result.language).toBe('de');
        });

        it('should handle missing locale', () => {
            const profile: LiProfile = {};

            const result = parseProfileLanguage(profile);

            expect(result.language).toBe('English');
            expect(result.fluency).toBe('Native Speaker');
        });
    });

    describe('buildLinkedInProfileUrl', () => {
        it('should build correct LinkedIn URL', () => {
            const url = buildLinkedInProfileUrl('john-doe');

            expect(url).toBe('https://www.linkedin.com/in/john-doe');
        });

        it('should handle undefined identifier', () => {
            const url = buildLinkedInProfileUrl(undefined);

            expect(url).toBe('');
        });

        it('should handle empty identifier', () => {
            const url = buildLinkedInProfileUrl('');

            expect(url).toBe('');
        });
    });

    describe('addSocialProfile', () => {
        it('should add social profile', () => {
            const basics: ResumeBasicsLegacy = {
                name: 'John Doe',
                label: '',
                summary: '',
                location: { countryCode: 'US' },
                profiles: []
            };

            addSocialProfile(basics, 'GitHub', 'johndoe', 'https://github.com/johndoe');

            expect(basics.profiles).toHaveLength(1);
            expect(basics.profiles[0].network).toBe('GitHub');
            expect(basics.profiles[0].username).toBe('johndoe');
            expect(basics.profiles[0].url).toBe('https://github.com/johndoe');
        });

        it('should not add duplicate profiles', () => {
            const basics: ResumeBasicsLegacy = {
                name: 'John Doe',
                label: '',
                summary: '',
                location: { countryCode: 'US' },
                profiles: [{ network: 'GitHub', username: 'johndoe', url: 'https://github.com/johndoe' }]
            };

            addSocialProfile(basics, 'GitHub', 'johndoe2', 'https://github.com/johndoe2');

            expect(basics.profiles).toHaveLength(1);
        });

        it('should be case-insensitive for duplicate detection', () => {
            const basics: ResumeBasicsLegacy = {
                name: 'John Doe',
                label: '',
                summary: '',
                location: { countryCode: 'US' },
                profiles: [{ network: 'GitHub', username: 'johndoe', url: 'https://github.com/johndoe' }]
            };

            addSocialProfile(basics, 'github', 'johndoe2', 'https://github.com/johndoe2');

            expect(basics.profiles).toHaveLength(1);
        });

        it('should not add profile with empty username', () => {
            const basics: ResumeBasicsLegacy = {
                name: 'John Doe',
                label: '',
                summary: '',
                location: { countryCode: 'US' },
                profiles: []
            };

            addSocialProfile(basics, 'GitHub', '', 'https://github.com/johndoe');

            expect(basics.profiles).toHaveLength(0);
        });

        it('should not add profile with empty URL', () => {
            const basics: ResumeBasicsLegacy = {
                name: 'John Doe',
                label: '',
                summary: '',
                location: { countryCode: 'US' },
                profiles: []
            };

            addSocialProfile(basics, 'GitHub', 'johndoe', '');

            expect(basics.profiles).toHaveLength(0);
        });
    });

    describe('parseFullName', () => {
        it('should parse first and last name', () => {
            const result = parseFullName('John Doe');

            expect(result.firstName).toBe('John');
            expect(result.lastName).toBe('Doe');
        });

        it('should handle single name', () => {
            const result = parseFullName('John');

            expect(result.firstName).toBe('John');
            expect(result.lastName).toBe('');
        });

        it('should handle multiple last names', () => {
            const result = parseFullName('John von Doe Smith');

            expect(result.firstName).toBe('John');
            expect(result.lastName).toBe('von Doe Smith');
        });

        it('should handle empty name', () => {
            const result = parseFullName('');

            expect(result.firstName).toBe('');
            expect(result.lastName).toBe('');
        });

        it('should trim whitespace', () => {
            const result = parseFullName('  John   Doe  ');

            expect(result.firstName).toBe('John');
            expect(result.lastName).toBe('Doe');
        });
    });

    describe('validateBasics', () => {
        it('should validate correct basics', () => {
            const basics: ResumeBasicsLegacy = {
                name: 'John Doe',
                label: '',
                summary: '',
                location: { countryCode: 'US' },
                profiles: []
            };

            const result = validateBasics(basics);

            expect(result).toBe(true);
        });

        it('should reject basics without name', () => {
            const basics: ResumeBasicsLegacy = {
                name: '',
                label: '',
                summary: '',
                location: { countryCode: 'US' },
                profiles: []
            };

            const result = validateBasics(basics);

            expect(result).toBe(false);
        });

        it('should reject basics with only whitespace name', () => {
            const basics: ResumeBasicsLegacy = {
                name: '   ',
                label: '',
                summary: '',
                location: { countryCode: 'US' },
                profiles: []
            };

            const result = validateBasics(basics);

            expect(result).toBe(false);
        });

        it('should reject basics without country code', () => {
            const basics: ResumeBasicsLegacy = {
                name: 'John Doe',
                label: '',
                summary: '',
                location: { countryCode: '' },
                profiles: []
            };

            const result = validateBasics(basics);

            expect(result).toBe(false);
        });
    });

    describe('mergeBasics', () => {
        it('should merge basics objects', () => {
            const target: ResumeBasicsLegacy = {
                name: 'John Doe',
                label: 'Developer',
                summary: '',
                location: { countryCode: 'US' },
                profiles: []
            };

            const source = {
                summary: 'Experienced developer',
                email: 'john@example.com'
            };

            const result = mergeBasics(target, source);

            expect(result.name).toBe('John Doe');
            expect(result.summary).toBe('Experienced developer');
            expect(result.email).toBe('john@example.com');
        });

        it('should merge location deeply', () => {
            const target: ResumeBasicsLegacy = {
                name: 'John Doe',
                label: '',
                summary: '',
                location: { countryCode: 'US' },
                profiles: []
            };

            const source = {
                location: { countryCode: 'US', address: 'San Francisco', city: 'SF' }
            };

            const result = mergeBasics(target, source);

            expect(result.location.countryCode).toBe('US');
            expect(result.location.address).toBe('San Francisco');
            expect(result.location.city).toBe('SF');
        });

        it('should merge profiles and deduplicate', () => {
            const target: ResumeBasicsLegacy = {
                name: 'John Doe',
                label: '',
                summary: '',
                location: { countryCode: 'US' },
                profiles: [{ network: 'GitHub', username: 'john', url: 'https://github.com/john' }]
            };

            const source = {
                profiles: [
                    { network: 'GitHub', username: 'john2', url: 'https://github.com/john2' },
                    { network: 'Twitter', username: 'john', url: 'https://twitter.com/john' }
                ]
            };

            const result = mergeBasics(target, source);

            expect(result.profiles).toHaveLength(2);
            expect(result.profiles.map((p) => p.network)).toEqual(['GitHub', 'Twitter']);
        });
    });

    describe('sanitizeBasics', () => {
        it('should remove HTML tags from name', () => {
            const basics: ResumeBasicsLegacy = {
                name: '<script>alert("xss")</script>John Doe',
                label: '',
                summary: '',
                location: { countryCode: 'US' },
                profiles: []
            };

            const result = sanitizeBasics(basics);

            expect(result.name).toBe('John Doe');
            expect(result.name).not.toContain('<script>');
        });

        it('should remove HTML tags from summary', () => {
            const basics: ResumeBasicsLegacy = {
                name: 'John Doe',
                label: '',
                summary: 'Developer with <b>10 years</b> experience',
                location: { countryCode: 'US' },
                profiles: []
            };

            const result = sanitizeBasics(basics);

            expect(result.summary).toBe('Developer with 10 years experience');
        });

        it('should remove HTML tags from address', () => {
            const basics: ResumeBasicsLegacy = {
                name: 'John Doe',
                label: '',
                summary: '',
                location: {
                    countryCode: 'US',
                    address: '<img src=x onerror=alert(1)>San Francisco'
                },
                profiles: []
            };

            const result = sanitizeBasics(basics);

            expect(result.location.address).toBe('San Francisco');
        });

        it('should handle basics without dangerous content', () => {
            const basics: ResumeBasicsLegacy = {
                name: 'John Doe',
                label: 'Developer',
                summary: 'Experienced developer',
                location: {
                    countryCode: 'US',
                    address: 'San Francisco, CA'
                },
                profiles: []
            };

            const result = sanitizeBasics(basics);

            expect(result).toEqual(basics);
        });
    });
});
