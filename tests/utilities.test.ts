import { zeroLeftPad, parseStartDate, parseEndDate, liDateToJSDate, getCookie, noNullOrUndef, lazyCopy, setQueryParams } from '../src/utilities';

describe('Utilities', () => {
    describe('zeroLeftPad', () => {
        it('should pad single digit numbers with zero', () => {
            expect(zeroLeftPad(5)).toBe('05');
            expect(zeroLeftPad(9)).toBe('09');
        });

        it('should not pad double digit numbers', () => {
            expect(zeroLeftPad(10)).toBe('10');
            expect(zeroLeftPad(25)).toBe('25');
        });
    });

    describe('parseStartDate', () => {
        it('should parse complete date object', () => {
            const dateObj = { year: 2020, month: 6, day: 15 };
            expect(parseStartDate(dateObj)).toBe('2020-06-15');
        });

        it('should use default month and day for incomplete dates', () => {
            const dateObj = { year: 2020 };
            expect(parseStartDate(dateObj)).toBe('2020-01-01');
        });

        it('should return empty string for undefined year', () => {
            expect(parseStartDate(undefined)).toBe('');
            expect(parseStartDate({})).toBe('');
        });
    });

    describe('parseEndDate', () => {
        it('should parse complete date object', () => {
            const dateObj = { year: 2020, month: 6, day: 15 };
            expect(parseEndDate(dateObj)).toBe('2020-06-15');
        });

        it('should use default month and day for incomplete dates', () => {
            const dateObj = { year: 2020 };
            expect(parseEndDate(dateObj)).toBe('2020-12-31');
        });
    });

    describe('liDateToJSDate', () => {
        it('should convert LinkedIn date to JavaScript Date', () => {
            const liDate = { year: 2020, month: 6, day: 15 };
            const jsDate = liDateToJSDate(liDate);
            expect(jsDate).toBeInstanceOf(Date);
            expect(jsDate.getFullYear()).toBe(2020);
            expect(jsDate.getMonth()).toBe(5); // JavaScript months are 0-indexed
            expect(jsDate.getDate()).toBe(15);
        });
    });

    describe('getCookie', () => {
        beforeEach(() => {
            // Mock document.cookie
            Object.defineProperty(document, 'cookie', {
                writable: true,
                value: 'JSESSIONID="test-session-id"; other=value'
            });
        });

        it('should return cookie value when found', () => {
            expect(getCookie('JSESSIONID')).toBe('"test-session-id"');
            expect(getCookie('other')).toBe('value');
        });

        it('should return null when cookie not found', () => {
            expect(getCookie('nonexistent')).toBe(null);
        });
    });

    describe('noNullOrUndef', () => {
        it('should return value when not null or undefined', () => {
            expect(noNullOrUndef('test')).toBe('test');
            expect(noNullOrUndef(0)).toBe(0);
            expect(noNullOrUndef(false)).toBe(false);
        });

        it('should return default value when null or undefined', () => {
            expect(noNullOrUndef(null)).toBe('');
            expect(noNullOrUndef(undefined)).toBe('');
            expect(noNullOrUndef(null, 'default')).toBe('default');
        });
    });

    describe('lazyCopy', () => {
        it('should create a deep copy of object', () => {
            const original = { a: 1, b: { c: 2 } };
            const copy = lazyCopy(original);

            expect(copy).toEqual(original);
            expect(copy).not.toBe(original);
            expect(copy.b).not.toBe(original.b);
        });

        it('should remove specified keys', () => {
            const original = { a: 1, b: 2, c: 3 };
            const copy = lazyCopy(original, ['b']);

            expect(copy).toEqual({ a: 1, c: 3 });
            expect(copy).not.toHaveProperty('b');
        });
    });

    describe('setQueryParams', () => {
        it('should add new query parameters', () => {
            const url = 'https://example.com';
            const result = setQueryParams(url, { param1: 'value1', param2: 'value2' });
            expect(result).toBe('https://example.com/?param1=value1&param2=value2');
        });

        it('should preserve existing query parameters', () => {
            const url = 'https://example.com?existing=value';
            const result = setQueryParams(url, { new: 'param' });
            expect(result).toBe('https://example.com/?existing=value&new=param');
        });

        it('should override existing parameters with same name', () => {
            const url = 'https://example.com?param=old';
            const result = setQueryParams(url, { param: 'new' });
            expect(result).toBe('https://example.com/?param=new');
        });
    });
});
