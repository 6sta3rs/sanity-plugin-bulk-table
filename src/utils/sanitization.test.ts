import { describe, expect, it } from 'vitest';

import { sanitizeGroqInput } from './sanitization';

// The sanitized output gets interpolated straight into a GROQ string
// literal: `match "<input>*"`. Anything that could close that literal or
// reach outside it must be stripped.
describe('sanitizeGroqInput', () => {
  it.each([
    ['"', 'double quote'],
    ['\\', 'backslash'],
    ['`', 'backtick'],
    ['$', 'dollar sign'],
    [';', 'semicolon'],
    ['{', 'open brace'],
    ['}', 'close brace'],
    ['[', 'open bracket'],
    [']', 'close bracket'],
    ['|', 'pipe'],
  ])('strips %s (%s)', (char) => {
    expect(sanitizeGroqInput(`foo${char}bar`)).not.toContain(char);
  });

  it('does not block a search containing an apostrophe (regression: apostrophes used to reject the whole query)', () => {
    // The single quote itself is stripped (it's redundant once double quotes
    // are gone - a bare `'` can't escape a `"..."` GROQ literal), but the
    // function must degrade to a usable, non-empty search term instead of
    // rejecting the input outright.
    const result = sanitizeGroqInput("O'Brien");
    expect(result).toBe('OBrien');
    expect(result.length).toBeGreaterThan(0);
  });

  it('trims whitespace', () => {
    expect(sanitizeGroqInput('  hello  ')).toBe('hello');
  });

  it('limits length to 100 characters', () => {
    const long = 'a'.repeat(150);
    expect(sanitizeGroqInput(long)).toHaveLength(100);
  });

  it('returns an empty string for non-string input', () => {
    // @ts-expect-error - deliberately passing a bad type
    expect(sanitizeGroqInput(null)).toBe('');
    expect(sanitizeGroqInput('')).toBe('');
  });
});
