import { parseSkill, parseSkillsList, pushSkill, mergeSkills, extractSkillsFromText, groupSkillsByCategory, LiSkill, ResumeSkill } from '../../src/parsers/skills-parser';

describe('Skills Parser', () => {
    describe('parseSkill', () => {
        it('should parse skill with name property', () => {
            const skill: LiSkill = {
                name: 'JavaScript'
            };

            const result = parseSkill(skill);

            expect(result).toEqual({
                name: 'JavaScript',
                level: '',
                keywords: []
            });
        });

        it('should parse skill with nested skill.name property', () => {
            const skill: LiSkill = {
                skill: {
                    name: 'TypeScript'
                }
            };

            const result = parseSkill(skill);

            expect(result.name).toBe('TypeScript');
        });

        it('should handle undefined skill name', () => {
            const skill: LiSkill = {};

            const result = parseSkill(skill);

            expect(result.name).toBe('');
        });

        it('should prefer direct name over nested name', () => {
            const skill: LiSkill = {
                name: 'Direct Name',
                skill: {
                    name: 'Nested Name'
                }
            };

            const result = parseSkill(skill);

            expect(result.name).toBe('Direct Name');
        });
    });

    describe('parseSkillsList', () => {
        it('should parse multiple skills', () => {
            const skills: LiSkill[] = [{ name: 'JavaScript' }, { name: 'Python' }, { name: 'Go' }];

            const result = parseSkillsList(skills);

            expect(result).toHaveLength(3);
            expect(result[0].name).toBe('JavaScript');
            expect(result[1].name).toBe('Python');
            expect(result[2].name).toBe('Go');
        });

        it('should handle empty skills array', () => {
            const result = parseSkillsList([]);
            expect(result).toEqual([]);
        });

        it('should preserve order of skills', () => {
            const skills: LiSkill[] = [{ name: 'Z Skill' }, { name: 'A Skill' }, { name: 'M Skill' }];

            const result = parseSkillsList(skills);

            expect(result.map((s) => s.name)).toEqual(['Z Skill', 'A Skill', 'M Skill']);
        });
    });

    describe('pushSkill', () => {
        it('should add new skill to array', () => {
            const skills: ResumeSkill[] = [];

            pushSkill(skills, 'JavaScript');

            expect(skills).toHaveLength(1);
            expect(skills[0].name).toBe('JavaScript');
        });

        it('should prevent duplicate skills (case-sensitive names)', () => {
            const skills: ResumeSkill[] = [{ name: 'JavaScript', level: '', keywords: [] }];

            pushSkill(skills, 'JavaScript');

            expect(skills).toHaveLength(1);
        });

        it('should prevent duplicate skills (case-insensitive)', () => {
            const skills: ResumeSkill[] = [{ name: 'JavaScript', level: '', keywords: [] }];

            pushSkill(skills, 'javascript');
            pushSkill(skills, 'JAVASCRIPT');

            expect(skills).toHaveLength(1);
        });

        it('should add different skills', () => {
            const skills: ResumeSkill[] = [{ name: 'JavaScript', level: '', keywords: [] }];

            pushSkill(skills, 'TypeScript');
            pushSkill(skills, 'Python');

            expect(skills).toHaveLength(3);
            expect(skills.map((s) => s.name)).toEqual(['JavaScript', 'TypeScript', 'Python']);
        });

        it('should handle empty skill name', () => {
            const skills: ResumeSkill[] = [];

            pushSkill(skills, '');

            expect(skills).toHaveLength(0);
        });

        it('should return the array for chaining', () => {
            const skills: ResumeSkill[] = [];

            const result = pushSkill(skills, 'JavaScript');

            expect(result).toBe(skills);
        });
    });

    describe('mergeSkills', () => {
        it('should merge skills from multiple sources', () => {
            const source1: LiSkill[] = [{ name: 'JavaScript' }, { name: 'TypeScript' }];
            const source2: LiSkill[] = [{ name: 'Python' }, { name: 'Go' }];

            const result = mergeSkills(source1, source2);

            expect(result).toHaveLength(4);
            expect(result.map((s) => s.name)).toEqual(['JavaScript', 'TypeScript', 'Python', 'Go']);
        });

        it('should deduplicate skills across sources', () => {
            const source1: LiSkill[] = [{ name: 'JavaScript' }, { name: 'Python' }];
            const source2: LiSkill[] = [
                { name: 'JavaScript' }, // Duplicate
                { name: 'Go' }
            ];

            const result = mergeSkills(source1, source2);

            expect(result).toHaveLength(3);
            expect(result.map((s) => s.name)).toEqual(['JavaScript', 'Python', 'Go']);
        });

        it('should handle empty sources', () => {
            const result = mergeSkills([], []);
            expect(result).toEqual([]);
        });

        it('should handle nested skill.name format', () => {
            const source1: LiSkill[] = [{ skill: { name: 'JavaScript' } }];
            const source2: LiSkill[] = [{ name: 'TypeScript' }];

            const result = mergeSkills(source1, source2);

            expect(result).toHaveLength(2);
            expect(result.map((s) => s.name)).toEqual(['JavaScript', 'TypeScript']);
        });

        it('should skip skills without names', () => {
            const source: LiSkill[] = [
                { name: 'JavaScript' },
                {}, // No name
                { name: 'Python' }
            ];

            const result = mergeSkills(source);

            expect(result).toHaveLength(2);
        });
    });

    describe('extractSkillsFromText', () => {
        it('should extract skills from text', () => {
            const text = 'Worked with JavaScript and Python to build web applications';
            const knownSkills = ['JavaScript', 'Python', 'Go', 'Ruby'];

            const result = extractSkillsFromText(text, knownSkills);

            expect(result).toContain('JavaScript');
            expect(result).toContain('Python');
            expect(result).not.toContain('Go');
            expect(result).not.toContain('Ruby');
        });

        it('should be case-insensitive', () => {
            const text = 'Used JAVASCRIPT and python';
            const knownSkills = ['JavaScript', 'Python'];

            const result = extractSkillsFromText(text, knownSkills);

            expect(result).toHaveLength(2);
        });

        it('should match whole words only', () => {
            const text = 'Used Java and JavaScript';
            const knownSkills = ['Java', 'JavaScript'];

            const result = extractSkillsFromText(text, knownSkills);

            expect(result).toContain('Java');
            expect(result).toContain('JavaScript');
            expect(result).toHaveLength(2);
        });

        it('should prevent duplicates', () => {
            const text = 'JavaScript, JavaScript, and more JavaScript';
            const knownSkills = ['JavaScript'];

            const result = extractSkillsFromText(text, knownSkills);

            expect(result).toHaveLength(1);
        });

        it('should handle empty text', () => {
            const result = extractSkillsFromText('', ['JavaScript']);
            expect(result).toEqual([]);
        });

        it('should handle empty known skills', () => {
            const result = extractSkillsFromText('JavaScript and Python', []);
            expect(result).toEqual([]);
        });
    });

    describe('groupSkillsByCategory', () => {
        it('should group skills by category', () => {
            const skills: ResumeSkill[] = [
                { name: 'JavaScript', level: '', keywords: [] },
                { name: 'React', level: '', keywords: [] },
                { name: 'Node.js', level: '', keywords: [] },
                { name: 'Python', level: '', keywords: [] }
            ];
            const categories = {
                Frontend: ['JavaScript', 'React'],
                Backend: ['Node.js', 'Python']
            };

            const result = groupSkillsByCategory(skills, categories);

            expect(result['Frontend']).toHaveLength(2);
            expect(result['Backend']).toHaveLength(2);
            expect(result['Frontend'].map((s) => s.name)).toEqual(['JavaScript', 'React']);
            expect(result['Backend'].map((s) => s.name)).toEqual(['Node.js', 'Python']);
        });

        it('should handle uncategorized skills', () => {
            const skills: ResumeSkill[] = [
                { name: 'JavaScript', level: '', keywords: [] },
                { name: 'Unknown Skill', level: '', keywords: [] }
            ];
            const categories = {
                Frontend: ['JavaScript']
            };

            const result = groupSkillsByCategory(skills, categories);

            expect(result['Frontend']).toHaveLength(1);
            expect(result['Other']).toHaveLength(1);
            expect(result['Other'][0].name).toBe('Unknown Skill');
        });

        it('should be case-insensitive for categorization', () => {
            const skills: ResumeSkill[] = [{ name: 'javascript', level: '', keywords: [] }];
            const categories = {
                Frontend: ['JavaScript']
            };

            const result = groupSkillsByCategory(skills, categories);

            expect(result['Frontend']).toHaveLength(1);
        });

        it('should handle empty skills array', () => {
            const categories = {
                Frontend: ['JavaScript']
            };

            const result = groupSkillsByCategory([], categories);

            expect(result['Frontend']).toEqual([]);
        });

        it('should initialize all categories even if empty', () => {
            const skills: ResumeSkill[] = [];
            const categories = {
                Frontend: ['JavaScript'],
                Backend: ['Node.js'],
                DevOps: ['Docker']
            };

            const result = groupSkillsByCategory(skills, categories);

            expect(result).toHaveProperty('Frontend');
            expect(result).toHaveProperty('Backend');
            expect(result).toHaveProperty('DevOps');
            expect(result['Frontend']).toEqual([]);
        });

        it('should not create Other category if all skills are categorized', () => {
            const skills: ResumeSkill[] = [{ name: 'JavaScript', level: '', keywords: [] }];
            const categories = {
                Frontend: ['JavaScript']
            };

            const result = groupSkillsByCategory(skills, categories);

            expect(result).not.toHaveProperty('Other');
        });
    });

    describe('Edge Cases', () => {
        it('should handle skills with special characters', () => {
            const skill: LiSkill = {
                name: 'C++'
            };

            const result = parseSkill(skill);

            expect(result.name).toBe('C++');
        });

        it('should handle skills with spaces and dots', () => {
            const skill: LiSkill = {
                name: 'Node.js'
            };

            const result = parseSkill(skill);

            expect(result.name).toBe('Node.js');
        });

        it('should handle very long skill names', () => {
            const longName = 'A'.repeat(100);
            const skill: LiSkill = {
                name: longName
            };

            const result = parseSkill(skill);

            expect(result.name).toHaveLength(100);
        });
    });
});
