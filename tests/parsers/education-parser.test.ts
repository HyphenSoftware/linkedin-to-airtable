import { parseEducation, parseEducationList, LiEducation, InternalDb } from '../../src/parsers/education-parser';

describe('Education Parser', () => {
    let mockDb: InternalDb;
    let mockLogger: { warn: jest.Mock };

    beforeEach(() => {
        mockDb = {
            entitiesByUrn: {},
            getElementsByType: jest.fn(() => [])
        };
        mockLogger = {
            warn: jest.fn()
        };
    });

    describe('parseEducation', () => {
        it('should parse basic education info', () => {
            const edu: LiEducation = {
                schoolName: 'Massachusetts Institute of Technology',
                fieldOfStudy: 'Computer Science',
                degreeName: 'Bachelor of Science',
                grade: '3.8'
            };

            const result = parseEducation(edu, mockDb);

            expect(result.legacy.institution).toBe('Massachusetts Institute of Technology');
            expect(result.legacy.area).toBe('Computer Science');
            expect(result.legacy.studyType).toBe('Bachelor of Science');
            expect(result.legacy.gpa).toBe('3.8');
            expect(result.legacy.courses).toEqual([]);
        });

        it('should parse stable format correctly', () => {
            const edu: LiEducation = {
                schoolName: 'Stanford University',
                fieldOfStudy: 'Electrical Engineering',
                degreeName: 'Master of Science',
                grade: '4.0'
            };

            const result = parseEducation(edu, mockDb);

            expect(result.stable.institution).toBe('Stanford University');
            expect(result.stable.area).toBe('Electrical Engineering');
            expect(result.stable.studyType).toBe('Master of Science');
            expect(result.stable.score).toBe('4.0');
        });

        it('should handle undefined fields gracefully', () => {
            const edu: LiEducation = {
                schoolName: 'Test University'
                // Missing other fields
            };

            const result = parseEducation(edu, mockDb);

            expect(result.legacy.institution).toBe('Test University');
            expect(result.legacy.area).toBe('');
            expect(result.legacy.studyType).toBe('');
            expect(result.legacy.gpa).toBe('');
        });

        it('should parse dates when provided', () => {
            const edu: LiEducation = {
                schoolName: 'Harvard University',
                fieldOfStudy: 'Law',
                degreeName: 'Juris Doctor',
                timePeriod: {
                    startDate: { year: 2015, month: 9 },
                    endDate: { year: 2018, month: 5 }
                }
            };

            const result = parseEducation(edu, mockDb);

            expect(result.legacy.startDate).toBe('2015-09-01');
            expect(result.legacy.endDate).toBe('2018-05-31');
            expect(result.stable.startDate).toBe('2015-09-01');
            expect(result.stable.endDate).toBe('2018-05-31');
        });

        it('should parse courses (old format with direct URN array)', () => {
            const edu: LiEducation = {
                schoolName: 'Test University',
                courses: ['urn:course:1', 'urn:course:2']
            };

            mockDb.entitiesByUrn = {
                'urn:course:1': {
                    number: 'CS101',
                    name: 'Introduction to Computer Science'
                },
                'urn:course:2': {
                    number: 'CS102',
                    name: 'Data Structures'
                }
            };

            const result = parseEducation(edu, mockDb);

            expect(result.legacy.courses).toEqual(['CS101 - Introduction to Computer Science', 'CS102 - Data Structures']);
            expect(result.stable.courses).toEqual(result.legacy.courses);
        });

        it('should warn when course URN not found', () => {
            const edu: LiEducation = {
                schoolName: 'Test University',
                courses: ['urn:course:missing']
            };

            parseEducation(edu, mockDb, mockLogger);

            expect(mockLogger.warn).toHaveBeenCalledWith('could not find course:', 'urn:course:missing');
        });

        it('should parse courses (new Dash format with union field)', () => {
            const edu: LiEducation = {
                schoolName: 'Test University',
                entityUrn: 'urn:education:123'
                // No direct courses array
            };

            const mockCourses = [
                {
                    number: 'MATH201',
                    name: 'Linear Algebra',
                    occupationUnion: {
                        profileEducation: 'urn:education:123'
                    }
                },
                {
                    number: 'MATH202',
                    name: 'Calculus',
                    occupationUnion: {
                        profileEducation: 'urn:education:456' // Different education
                    }
                },
                {
                    number: 'PHYS101',
                    name: 'Physics',
                    occupationUnion: {
                        profileEducation: 'urn:education:123'
                    }
                }
            ];

            (mockDb.getElementsByType as jest.Mock).mockReturnValue(mockCourses);

            const result = parseEducation(edu, mockDb);

            expect(result.legacy.courses).toEqual(['MATH201 - Linear Algebra', 'PHYS101 - Physics']);
        });

        it('should handle empty courses array', () => {
            const edu: LiEducation = {
                schoolName: 'Test University',
                courses: []
            };

            const result = parseEducation(edu, mockDb);

            expect(result.legacy.courses).toEqual([]);
        });

        it('should handle education without courses field', () => {
            const edu: LiEducation = {
                schoolName: 'Test University'
                // No courses field at all
            };

            const result = parseEducation(edu, mockDb);

            expect(result.legacy.courses).toEqual([]);
        });
    });

    describe('parseEducationList', () => {
        it('should parse multiple education entries', () => {
            const educationArray: LiEducation[] = [
                {
                    schoolName: 'MIT',
                    fieldOfStudy: 'Computer Science',
                    degreeName: 'BS'
                },
                {
                    schoolName: 'Stanford',
                    fieldOfStudy: 'Machine Learning',
                    degreeName: 'MS'
                }
            ];

            const result = parseEducationList(educationArray, mockDb);

            expect(result.legacy).toHaveLength(2);
            expect(result.stable).toHaveLength(2);
            expect(result.legacy[0].institution).toBe('MIT');
            expect(result.legacy[1].institution).toBe('Stanford');
            expect(result.stable[0].institution).toBe('MIT');
            expect(result.stable[1].institution).toBe('Stanford');
        });

        it('should handle empty education array', () => {
            const result = parseEducationList([], mockDb);

            expect(result.legacy).toEqual([]);
            expect(result.stable).toEqual([]);
        });

        it('should pass debug logger to individual parsers', () => {
            const educationArray: LiEducation[] = [
                {
                    schoolName: 'Test University',
                    courses: ['urn:course:missing']
                }
            ];

            parseEducationList(educationArray, mockDb, mockLogger);

            expect(mockLogger.warn).toHaveBeenCalled();
        });

        it('should preserve order of education entries', () => {
            const educationArray: LiEducation[] = [{ schoolName: 'University A' }, { schoolName: 'University B' }, { schoolName: 'University C' }];

            const result = parseEducationList(educationArray, mockDb);

            expect(result.legacy.map((e) => e.institution)).toEqual(['University A', 'University B', 'University C']);
        });
    });

    describe('Edge Cases', () => {
        it('should handle null/undefined education object fields', () => {
            const edu: LiEducation = {
                schoolName: undefined,
                fieldOfStudy: undefined,
                degreeName: undefined,
                grade: undefined
            };

            const result = parseEducation(edu, mockDb);

            expect(result.legacy.institution).toBe('');
            expect(result.legacy.area).toBe('');
            expect(result.legacy.studyType).toBe('');
            expect(result.legacy.gpa).toBe('');
        });

        it('should handle courses with missing number or name', () => {
            const edu: LiEducation = {
                schoolName: 'Test University',
                courses: ['urn:course:1']
            };

            mockDb.entitiesByUrn = {
                'urn:course:1': {
                    number: 'CS101'
                    // Missing name
                }
            };

            const result = parseEducation(edu, mockDb);

            expect(result.legacy.courses).toEqual(['CS101 - undefined']);
        });

        it('should handle Dash courses without occupationUnion', () => {
            const edu: LiEducation = {
                schoolName: 'Test University',
                entityUrn: 'urn:education:123'
            };

            const mockCourses = [
                {
                    number: 'MATH201',
                    name: 'Linear Algebra'
                    // No occupationUnion
                }
            ];

            (mockDb.getElementsByType as jest.Mock).mockReturnValue(mockCourses);

            const result = parseEducation(edu, mockDb);

            expect(result.legacy.courses).toEqual([]);
        });
    });
});
