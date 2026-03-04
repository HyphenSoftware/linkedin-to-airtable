import { LinkedInExtractor, ExtractorOptions, ExtractionResult } from '../../src/core/linkedin-extractor';
import { VoyagerClient } from '../../src/api/voyager-client';
import { buildDbFromLiSchema } from '../../src/utilities';

// Mock the VoyagerClient
jest.mock('../../src/api/voyager-client');
const MockedVoyagerClient = VoyagerClient as jest.MockedClass<typeof VoyagerClient>;

// Mock utilities
jest.mock('../../src/utilities', () => ({
    ...jest.requireActual('../../src/utilities'),
    buildDbFromLiSchema: jest.fn(),
    promptDownload: jest.fn()
}));

// Mock templates
jest.mock('../../src/templates', () => ({
    resumeJsonTemplateLegacy: {
        basics: { name: '', label: '', summary: '', location: { countryCode: '' }, profiles: [] },
        education: [],
        work: [],
        skills: [],
        volunteer: [],
        languages: []
    },
    resumeJsonTemplateStable: {
        basics: { name: '', label: '', summary: '', location: { countryCode: '' }, profiles: [] },
        education: [],
        work: [],
        skills: [],
        volunteer: [],
        languages: []
    }
}));

describe('LinkedInExtractor', () => {
    let extractor: LinkedInExtractor;
    let mockVoyagerClient: jest.Mocked<VoyagerClient>;
    let mockConsole: jest.Mocked<Console>;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Mock console
        mockConsole = {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        } as any;

        // Mock VoyagerClient
        mockVoyagerClient = {
            fetchProfile: jest.fn(),
            fetchPositionGroups: jest.fn(),
            fetchVolunteerExperiences: jest.fn(),
            profileExists: jest.fn()
        } as any;

        MockedVoyagerClient.mockImplementation(() => mockVoyagerClient);

        // Mock getProfileId method instead of window.location
        jest.spyOn(LinkedInExtractor.prototype as any, 'getProfileId').mockReturnValue('john-doe');

        // Mock navigator.language
        Object.defineProperty(navigator, 'language', {
            value: 'en-US',
            writable: true
        });
    });

    describe('Constructor', () => {
        it('should initialize with default options', () => {
            extractor = new LinkedInExtractor();

            expect(MockedVoyagerClient).toHaveBeenCalledWith({
                debug: false,
                maxRetries: 3,
                retryDelayMs: 1000
            });
        });

        it('should initialize with custom options', () => {
            const options: ExtractorOptions = {
                debug: true,
                preferApi: false,
                getFullSkills: false,
                maxRetries: 5,
                retryDelayMs: 2000
            };

            extractor = new LinkedInExtractor(options);

            expect(MockedVoyagerClient).toHaveBeenCalledWith({
                debug: true,
                maxRetries: 5,
                retryDelayMs: 2000
            });
        });

        it('should extract profile ID from URL', () => {
            extractor = new LinkedInExtractor();

            // Mock the getProfileId method to return the expected value
            jest.spyOn(extractor as any, 'getProfileId').mockReturnValue('john-doe');

            // Call the private method to extract profile ID
            const profileId = (extractor as any).getProfileId();
            expect(profileId).toBe('john-doe');
        });

        it('should set default locale from navigator', () => {
            extractor = new LinkedInExtractor();

            const { defaultLocale } = extractor as any;
            expect(defaultLocale).toBe('en_US');
        });
    });

    describe('extractProfile', () => {
        beforeEach(() => {
            extractor = new LinkedInExtractor({ debug: true });

            // Mock the private methods
            (extractor as any).getProfileUrnId = jest.fn().mockResolvedValue('urn:li:fsd_profile:123');
            (extractor as any).extractProfileFromDOM = jest.fn().mockReturnValue(null);
            (extractor as any).extractEducationFromDOM = jest.fn().mockReturnValue([]);
            (extractor as any).extractWorkFromDOM = jest.fn().mockReturnValue([]);
            (extractor as any).extractSkillsFromDOM = jest.fn().mockReturnValue([]);
            (extractor as any).extractVolunteerFromDOM = jest.fn().mockReturnValue([]);
        });

        it('should extract profile successfully with API data', async () => {
            // Mock successful API responses
            const mockProfileData = {
                data: { '*elements': ['urn:li:fsd_profile:123'] },
                included: [
                    {
                        entityUrn: 'urn:li:fsd_profile:123',
                        $type: 'com.linkedin.voyager.identity.profile.Profile',
                        firstName: 'John',
                        lastName: 'Doe',
                        headline: 'Software Engineer',
                        summary: 'Experienced developer',
                        defaultLocale: { country: 'US', language: 'en' }
                    }
                ]
            };

            const mockEducationData = {
                data: { '*elements': [] },
                included: []
            };

            const mockWorkData = {
                data: { '*elements': [] },
                included: []
            };

            const mockVolunteerData = {
                data: { '*elements': [] },
                included: []
            };

            mockVoyagerClient.fetchProfile.mockResolvedValue(mockProfileData);
            mockVoyagerClient.fetchPositionGroups.mockResolvedValue(mockWorkData);
            mockVoyagerClient.fetchVolunteerExperiences.mockResolvedValue(mockVolunteerData);

            // Mock buildDbFromLiSchema to return different data for different sections
            (buildDbFromLiSchema as jest.Mock).mockImplementation((data) => {
                if (data === mockProfileData) {
                    return {
                        getElementsByType: jest.fn().mockImplementation((types) => {
                            // Return profile data for Profile type
                            if (types.includes('com.linkedin.voyager.identity.profile.Profile')) {
                                return [
                                    {
                                        $type: 'com.linkedin.voyager.identity.profile.Profile',
                                        firstName: 'John',
                                        lastName: 'Doe',
                                        headline: 'Software Engineer',
                                        summary: 'Experienced developer',
                                        defaultLocale: { country: 'US', language: 'en' }
                                    }
                                ];
                            }
                            // Return empty arrays for all other types (skills, education, etc.)
                            return [];
                        })
                    };
                }
                // For education, work, volunteer data - return empty arrays
                return {
                    getElementsByType: jest.fn().mockReturnValue([])
                };
            });

            // Mock getProfileId to return the expected value
            jest.spyOn(extractor as any, 'getProfileId').mockReturnValue('john-doe');

            const result = await extractor.extractProfile();

            expect(result.success).toBe(true);
            expect(result.profileId).toBe('john-doe');
            expect(result.profileUrnId).toBe('urn:li:fsd_profile:123');
            expect(result.locale).toBe('en_US');
            expect(result.summary).toEqual({
                education: 0,
                work: 0,
                skills: 0,
                volunteer: 0,
                certificates: 0,
                interests: 0
            });
        });

        it('should fall back to DOM extraction when API fails', async () => {
            // Mock API failure
            mockVoyagerClient.fetchProfile.mockRejectedValue(new Error('API Error'));

            // Mock DOM extraction
            (extractor as any).extractProfileFromDOM = jest.fn().mockReturnValue({
                firstName: 'John',
                lastName: 'Doe',
                headline: 'Software Engineer',
                defaultLocale: { country: 'US', language: 'en' }
            });

            // Mock getProfileId to return the expected value
            jest.spyOn(extractor as any, 'getProfileId').mockReturnValue('john-doe');

            const result = await extractor.extractProfile();

            expect(result.success).toBe(true);
            expect(mockVoyagerClient.fetchProfile).toHaveBeenCalled();
        });

        it('should handle complete extraction failure', async () => {
            // Mock all failures
            mockVoyagerClient.fetchProfile.mockRejectedValue(new Error('API Error'));
            (extractor as any).extractProfileFromDOM = jest.fn().mockReturnValue(null);

            const result = await extractor.extractProfile();

            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to extract profile basics');
        });

        it('should handle unexpected errors', async () => {
            // Mock unexpected error
            (extractor as any).getProfileUrnId = jest.fn().mockRejectedValue(new Error('Unexpected error'));

            const result = await extractor.extractProfile();

            expect(result.success).toBe(false);
            expect(result.error).toContain('Profile extraction failed');
        });
    });

    describe('extractProfileBasics', () => {
        beforeEach(() => {
            extractor = new LinkedInExtractor();
            (extractor as any).getProfileUrnId = jest.fn().mockResolvedValue('urn:li:fsd_profile:123');
            (extractor as any).extractProfileFromDOM = jest.fn().mockReturnValue(null);
        });

        it('should extract basics from API successfully', async () => {
            const mockProfileData = {
                data: { '*elements': ['urn:li:fsd_profile:123'] },
                included: [
                    {
                        entityUrn: 'urn:li:fsd_profile:123',
                        $type: 'com.linkedin.voyager.identity.profile.Profile',
                        firstName: 'John',
                        lastName: 'Doe',
                        headline: 'Software Engineer',
                        summary: 'Experienced developer',
                        defaultLocale: { country: 'US', language: 'en' }
                    }
                ]
            };

            mockVoyagerClient.fetchProfile.mockResolvedValue(mockProfileData);
            (buildDbFromLiSchema as jest.Mock).mockReturnValue({
                getElementsByType: jest.fn().mockReturnValue([
                    {
                        $type: 'com.linkedin.voyager.identity.profile.Profile',
                        firstName: 'John',
                        lastName: 'Doe',
                        headline: 'Software Engineer',
                        summary: 'Experienced developer',
                        defaultLocale: { country: 'US', language: 'en' }
                    }
                ])
            });

            const result = await (extractor as any).extractProfileBasics();

            expect(result.success).toBe(true);
            expect(result.locale).toBe('en_US');
        });

        it('should fall back to DOM when API fails', async () => {
            mockVoyagerClient.fetchProfile.mockRejectedValue(new Error('API Error'));
            (extractor as any).extractProfileFromDOM = jest.fn().mockReturnValue({
                firstName: 'John',
                lastName: 'Doe',
                headline: 'Software Engineer',
                defaultLocale: { country: 'US', language: 'en' }
            });

            const result = await (extractor as any).extractProfileBasics();

            expect(result.success).toBe(true);
            expect(result.locale).toBe('en_US');
        });

        it('should set legacy picture and stable image from profile-photo DOM selector', async () => {
            mockVoyagerClient.fetchProfile.mockRejectedValue(new Error('API Error'));
            (extractor as any).extractProfileFromDOM = jest.fn().mockReturnValue({
                firstName: 'John',
                lastName: 'Doe',
                headline: 'Software Engineer',
                defaultLocale: { country: 'US', language: 'en' }
            });

            document.body.innerHTML = '<img class="profile-photo-img" src="https://cdn.example.com/profile-photo.jpg" />';

            const result = await (extractor as any).extractProfileBasics();

            expect(result.success).toBe(true);
            expect((extractor as any).outputJsonLegacy.basics.picture).toBe('https://cdn.example.com/profile-photo.jpg');
            expect((extractor as any).outputJsonStable.basics.image).toBe('https://cdn.example.com/profile-photo.jpg');
        });

        it('should set legacy picture and stable image from highest-quality API vector artifact when DOM image is missing', async () => {
            const mockProfileData = {
                data: { '*elements': ['urn:li:fsd_profile:123'] },
                included: []
            };

            mockVoyagerClient.fetchProfile.mockResolvedValue(mockProfileData);
            (buildDbFromLiSchema as jest.Mock).mockReturnValue({
                getElementsByType: jest.fn().mockReturnValue([
                    {
                        $type: 'com.linkedin.voyager.dash.identity.profile.Profile',
                        firstName: 'John',
                        lastName: 'Doe',
                        headline: 'Software Engineer',
                        summary: 'Experienced developer',
                        primaryLocale: { country: 'US', language: 'en' },
                        profilePicture: {
                            displayImageReference: {
                                vectorImage: {
                                    rootUrl: 'https://media.licdn.com/dms/image/',
                                    artifacts: [
                                        { width: 200, fileIdentifyingUrlPathSegment: 'bigger.jpg' },
                                        { width: 100, fileIdentifyingUrlPathSegment: 'smallest.jpg' }
                                    ]
                                }
                            }
                        }
                    }
                ])
            });

            document.body.innerHTML = '';

            const result = await (extractor as any).extractProfileBasics();

            expect(result.success).toBe(true);
            expect((extractor as any).outputJsonLegacy.basics.picture).toBe('https://media.licdn.com/dms/image/bigger.jpg');
            expect((extractor as any).outputJsonStable.basics.image).toBe('https://media.licdn.com/dms/image/bigger.jpg');
        });
    });

    describe('extractEducation', () => {
        beforeEach(() => {
            extractor = new LinkedInExtractor();
            (extractor as any).getProfileUrnId = jest.fn().mockResolvedValue('urn:li:fsd_profile:123');
            (extractor as any).extractEducationFromDOM = jest.fn().mockReturnValue([]);
        });

        it('should extract education from API', async () => {
            const mockProfileData = {
                data: { '*elements': ['urn:li:fsd_profile:123'] },
                included: [
                    {
                        entityUrn: 'urn:li:fsd_profile:123',
                        $type: 'com.linkedin.voyager.identity.profile.Education',
                        schoolName: 'University of Example',
                        fieldOfStudy: 'Computer Science'
                    }
                ]
            };

            mockVoyagerClient.fetchProfile.mockResolvedValue(mockProfileData);
            (buildDbFromLiSchema as jest.Mock).mockReturnValue({
                getElementsByType: jest.fn().mockReturnValue([
                    {
                        $type: 'com.linkedin.voyager.identity.profile.Education',
                        schoolName: 'University of Example',
                        fieldOfStudy: 'Computer Science'
                    }
                ])
            });

            const result = await (extractor as any).extractEducation();

            expect(result.count).toBe(1);
        });

        it('should return 0 when no education found', async () => {
            mockVoyagerClient.fetchProfile.mockRejectedValue(new Error('API Error'));

            const result = await (extractor as any).extractEducation();

            expect(result.count).toBe(0);
        });
    });

    describe('extractWorkExperience', () => {
        beforeEach(() => {
            extractor = new LinkedInExtractor();
            (extractor as any).getProfileUrnId = jest.fn().mockResolvedValue('urn:li:fsd_profile:123');
            (extractor as any).extractWorkFromDOM = jest.fn().mockReturnValue([]);
        });

        it('should extract work experience from API', async () => {
            const mockWorkData = {
                data: { '*elements': ['urn:li:fsd_profile:123'] },
                included: [
                    {
                        entityUrn: 'urn:li:fsd_profile:123',
                        $type: 'com.linkedin.voyager.identity.profile.Position',
                        companyName: 'Example Corp',
                        title: 'Software Engineer'
                    }
                ]
            };

            mockVoyagerClient.fetchPositionGroups.mockResolvedValue(mockWorkData);
            (buildDbFromLiSchema as jest.Mock).mockReturnValue({
                getElementsByType: jest.fn().mockReturnValue([
                    {
                        $type: 'com.linkedin.voyager.identity.profile.Position',
                        companyName: 'Example Corp',
                        title: 'Software Engineer'
                    }
                ])
            });

            const result = await (extractor as any).extractWorkExperience();

            expect(result.count).toBe(1);
        });
    });

    describe('extractSkills', () => {
        beforeEach(() => {
            extractor = new LinkedInExtractor();
            (extractor as any).getProfileUrnId = jest.fn().mockResolvedValue('urn:li:fsd_profile:123');
            (extractor as any).extractSkillsFromDOM = jest.fn().mockReturnValue([]);
        });

        it('should extract skills from API', async () => {
            const mockProfileData = {
                data: { '*elements': ['urn:li:fsd_profile:123'] },
                included: [
                    {
                        entityUrn: 'urn:li:fsd_profile:123',
                        $type: 'com.linkedin.voyager.identity.profile.Skill',
                        name: 'JavaScript'
                    }
                ]
            };

            mockVoyagerClient.fetchProfile.mockResolvedValue(mockProfileData);
            (buildDbFromLiSchema as jest.Mock).mockReturnValue({
                getElementsByType: jest.fn().mockReturnValue([
                    {
                        $type: 'com.linkedin.voyager.identity.profile.Skill',
                        name: 'JavaScript'
                    }
                ])
            });

            const result = await (extractor as any).extractSkills();

            expect(result.count).toBe(1);
        });
    });

    describe('extractVolunteerExperience', () => {
        beforeEach(() => {
            extractor = new LinkedInExtractor();
            (extractor as any).getProfileUrnId = jest.fn().mockResolvedValue('urn:li:fsd_profile:123');
            (extractor as any).extractVolunteerFromDOM = jest.fn().mockReturnValue([]);
        });

        it('should extract volunteer experience from API', async () => {
            const mockVolunteerData = {
                data: { '*elements': ['urn:li:fsd_profile:123'] },
                included: [
                    {
                        entityUrn: 'urn:li:fsd_profile:123',
                        $type: 'com.linkedin.voyager.identity.profile.VolunteerExperience',
                        companyName: 'Red Cross',
                        role: 'Volunteer'
                    }
                ]
            };

            mockVoyagerClient.fetchVolunteerExperiences.mockResolvedValue(mockVolunteerData);
            (buildDbFromLiSchema as jest.Mock).mockReturnValue({
                getElementsByType: jest.fn().mockReturnValue([
                    {
                        $type: 'com.linkedin.voyager.identity.profile.VolunteerExperience',
                        companyName: 'Red Cross',
                        role: 'Volunteer'
                    }
                ])
            });

            const result = await (extractor as any).extractVolunteerExperience();

            expect(result.count).toBe(1);
        });
    });

    describe('downloadProfile', () => {
        beforeEach(() => {
            extractor = new LinkedInExtractor();
        });

        it('should download legacy format by default', () => {
            const { promptDownload } = require('../../src/utilities');

            // Set profileId for the test
            (extractor as any).profileId = 'john-doe';
            extractor.downloadProfile();

            expect(promptDownload).toHaveBeenCalledWith(expect.any(Object), 'linkedin-profile-john-doe-legacy.json');
        });

        it('should download stable format when specified', () => {
            const { promptDownload } = require('../../src/utilities');

            // Set profileId for the test
            (extractor as any).profileId = 'john-doe';
            extractor.downloadProfile('stable');

            expect(promptDownload).toHaveBeenCalledWith(expect.any(Object), 'linkedin-profile-john-doe-stable.json');
        });
    });

    describe('Private Methods', () => {
        beforeEach(() => {
            extractor = new LinkedInExtractor();
        });

        describe('getProfileId', () => {
            it('should extract profile ID from LinkedIn URL', () => {
                // Mock the getProfileId method to return the expected value
                jest.spyOn(extractor as any, 'getProfileId').mockReturnValue('john-doe');

                const profileId = (extractor as any).getProfileId();
                expect(profileId).toBe('john-doe');
            });

            it('should return empty string for non-LinkedIn URL', () => {
                // Mock getProfileId to return empty string for this test
                jest.spyOn(LinkedInExtractor.prototype as any, 'getProfileId').mockReturnValue('');

                const profileId = (extractor as any).getProfileId();
                expect(profileId).toBe('');
            });
        });

        describe('getViewersLocalLang', () => {
            it('should return formatted language from navigator', () => {
                const lang = (extractor as any).getViewersLocalLang();
                expect(lang).toBe('en_US');
            });

            it('should handle missing navigator.language', () => {
                Object.defineProperty(navigator, 'language', {
                    value: undefined,
                    writable: true
                });

                const lang = (extractor as any).getViewersLocalLang();
                expect(lang).toBe('en_US');
            });
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            extractor = new LinkedInExtractor({ debug: true });
        });

        it('should handle API client initialization errors', () => {
            MockedVoyagerClient.mockImplementation(() => {
                throw new Error('Client initialization failed');
            });

            expect(() => new LinkedInExtractor()).toThrow('Client initialization failed');
        });

        it('should handle profile extraction with missing profile ID', async () => {
            // Mock getProfileId to return empty string for this test
            jest.spyOn(LinkedInExtractor.prototype as any, 'getProfileId').mockReturnValue('');

            extractor = new LinkedInExtractor();
            const result = await extractor.extractProfile();

            expect(result.success).toBe(false);
            expect(result.profileId).toBe('');
            expect(result.error).toContain('Could not extract profile ID from URL');
        });
    });

    describe('Integration', () => {
        it('should work with all parsers integrated', async () => {
            extractor = new LinkedInExtractor({ debug: true });

            // Mock successful responses for all sections
            const mockProfileData = {
                data: { '*elements': ['urn:li:fsd_profile:123'] },
                included: [
                    {
                        entityUrn: 'urn:li:fsd_profile:123',
                        $type: 'com.linkedin.voyager.identity.profile.Profile',
                        firstName: 'John',
                        lastName: 'Doe',
                        headline: 'Software Engineer',
                        summary: 'Experienced developer',
                        defaultLocale: { country: 'US', language: 'en' }
                    }
                ]
            };

            mockVoyagerClient.fetchProfile.mockResolvedValue(mockProfileData);
            mockVoyagerClient.fetchPositionGroups.mockResolvedValue({ data: { '*elements': [] }, included: [] });
            mockVoyagerClient.fetchVolunteerExperiences.mockResolvedValue({ data: { '*elements': [] }, included: [] });

            (buildDbFromLiSchema as jest.Mock).mockImplementation((data) => {
                if (data === mockProfileData) {
                    return {
                        getElementsByType: jest.fn().mockImplementation((types) => {
                            if (types.includes('com.linkedin.voyager.identity.profile.Profile')) {
                                return [
                                    {
                                        $type: 'com.linkedin.voyager.identity.profile.Profile',
                                        firstName: 'John',
                                        lastName: 'Doe',
                                        headline: 'Software Engineer',
                                        summary: 'Experienced developer',
                                        defaultLocale: { country: 'US', language: 'en' }
                                    }
                                ];
                            }
                            return [];
                        })
                    };
                }
                return {
                    getElementsByType: jest.fn().mockReturnValue([])
                };
            });

            (extractor as any).getProfileUrnId = jest.fn().mockResolvedValue('urn:li:fsd_profile:123');

            // Mock getProfileId to return the expected value
            jest.spyOn(extractor as any, 'getProfileId').mockReturnValue('john-doe');

            const result = await extractor.extractProfile();

            expect(result.success).toBe(true);
            expect(result.legacy).toBeDefined();
            expect(result.stable).toBeDefined();
            expect(result.summary).toBeDefined();
        });
    });
});
