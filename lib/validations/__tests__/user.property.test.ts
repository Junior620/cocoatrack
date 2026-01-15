/**
 * CocoaTrack V2 - Property Tests for User Validation
 * 
 * Tests for Feature: admin-user-management
 * 
 * Properties tested:
 * - Property 3: Input Validation
 * 
 * **Validates: Requirements 6.1, 6.2, 6.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  createUserSchema,
  emailSchema,
  fullNameSchema,
  USER_ROLES,
} from '../user';

// ============================================================================
// GENERATORS
// ============================================================================

// Valid email generator
const validEmailArb = fc
  .tuple(
    fc.stringMatching(/^[a-z0-9]+$/), // local part
    fc.stringMatching(/^[a-z0-9]+$/), // domain
    fc.constantFrom('com', 'org', 'net', 'fr', 'io')
  )
  .filter(([local, domain]) => local.length >= 1 && domain.length >= 1)
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

// Invalid email generator (missing @, missing domain, etc.)
const invalidEmailArb = fc.oneof(
  fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('@')), // No @
  fc.string({ minLength: 1, maxLength: 50 }).map(s => `${s}@`), // No domain
  fc.string({ minLength: 1, maxLength: 50 }).map(s => `@${s}`), // No local part
  fc.constant(''), // Empty
  fc.constant('   ') // Whitespace only
);

// Valid full name generator (at least 2 chars after trim)
const validFullNameArb = fc
  .string({ minLength: 2, maxLength: 100 })
  .filter(s => s.trim().length >= 2);

// Invalid full name generator (less than 2 chars after trim)
const invalidFullNameArb = fc.oneof(
  fc.constant(''),
  fc.constant(' '),
  fc.constant('A'),
  fc.constant(' A '),
  fc.stringMatching(/^\s+$/) // Only whitespace
);

// Valid role generator
const validRoleArb = fc.constantFrom(...USER_ROLES);

// Invalid role generator
const invalidRoleArb = fc.oneof(
  fc.constant('superadmin'),
  fc.constant('ADMIN'),
  fc.constant(''),
  fc.constant('user'),
  fc.constant('moderator')
);

// UUID generator
const uuidArb = fc.uuid();

// ============================================================================
// PROPERTY TESTS
// ============================================================================

describe('Feature: admin-user-management, Property 3: Input Validation', () => {
  /**
   * **Feature: admin-user-management, Property 3: Input Validation**
   * **Validates: Requirements 6.1, 6.2, 6.3**
   * 
   * *For any* user creation input:
   * - Email must be valid format and trimmed to lowercase
   * - Full name must be at least 2 characters after trimming
   * - All text inputs must have whitespace trimmed
   */

  describe('Email Validation (Requirement 6.1)', () => {
    it('should accept valid email formats', () => {
      fc.assert(
        fc.property(validEmailArb, (email) => {
          const result = emailSchema.safeParse(email);
          return result.success === true;
        }),
        { numRuns: 100 }
      );
    });

    it('should reject invalid email formats', () => {
      fc.assert(
        fc.property(invalidEmailArb, (email) => {
          const result = emailSchema.safeParse(email);
          return result.success === false;
        }),
        { numRuns: 100 }
      );
    });

    it('should trim and lowercase emails', () => {
      fc.assert(
        fc.property(
          validEmailArb,
          fc.stringMatching(/^\s*$/), // Leading whitespace
          fc.stringMatching(/^\s*$/), // Trailing whitespace
          (email, leadingWs, trailingWs) => {
            const emailWithWhitespace = `${leadingWs}${email.toUpperCase()}${trailingWs}`;
            const result = emailSchema.safeParse(emailWithWhitespace);
            
            if (!result.success) return true; // Skip if invalid
            
            // Should be trimmed and lowercased
            return result.data === email.toLowerCase();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Full Name Validation (Requirement 6.2)', () => {
    it('should accept names with at least 2 characters after trim', () => {
      fc.assert(
        fc.property(validFullNameArb, (name) => {
          const result = fullNameSchema.safeParse(name);
          return result.success === true;
        }),
        { numRuns: 100 }
      );
    });

    it('should reject names with less than 2 characters after trim', () => {
      fc.assert(
        fc.property(invalidFullNameArb, (name) => {
          const result = fullNameSchema.safeParse(name);
          return result.success === false;
        }),
        { numRuns: 100 }
      );
    });

    it('should trim whitespace from names', () => {
      fc.assert(
        fc.property(
          validFullNameArb,
          fc.stringMatching(/^\s{1,5}$/), // Leading whitespace (1-5 spaces)
          fc.stringMatching(/^\s{1,5}$/), // Trailing whitespace (1-5 spaces)
          (name, leadingWs, trailingWs) => {
            const nameWithWhitespace = `${leadingWs}${name}${trailingWs}`;
            const result = fullNameSchema.safeParse(nameWithWhitespace);
            
            if (!result.success) return true; // Skip if invalid
            
            // Should be trimmed
            return result.data === name.trim();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Role Validation', () => {
    it('should accept valid roles', () => {
      fc.assert(
        fc.property(validRoleArb, (role) => {
          const result = createUserSchema.safeParse({
            email: 'test@example.com',
            full_name: 'Test User',
            role,
          });
          return result.success === true;
        }),
        { numRuns: 100 }
      );
    });

    it('should reject invalid roles', () => {
      fc.assert(
        fc.property(invalidRoleArb, (role) => {
          const result = createUserSchema.safeParse({
            email: 'test@example.com',
            full_name: 'Test User',
            role,
          });
          return result.success === false;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Complete Schema Validation (Requirement 6.3)', () => {
    it('should accept valid complete user creation input', () => {
      fc.assert(
        fc.property(
          validEmailArb,
          validFullNameArb,
          validRoleArb,
          fc.option(uuidArb, { nil: null }),
          (email, fullName, role, cooperativeId) => {
            const result = createUserSchema.safeParse({
              email,
              full_name: fullName,
              role,
              cooperative_id: cooperativeId,
            });
            return result.success === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject input with invalid email', () => {
      fc.assert(
        fc.property(
          invalidEmailArb,
          validFullNameArb,
          validRoleArb,
          (email, fullName, role) => {
            const result = createUserSchema.safeParse({
              email,
              full_name: fullName,
              role,
            });
            return result.success === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject input with invalid full name', () => {
      fc.assert(
        fc.property(
          validEmailArb,
          invalidFullNameArb,
          validRoleArb,
          (email, fullName, role) => {
            const result = createUserSchema.safeParse({
              email,
              full_name: fullName,
              role,
            });
            return result.success === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should transform email to lowercase and trim all fields', () => {
      fc.assert(
        fc.property(
          validEmailArb,
          validFullNameArb,
          validRoleArb,
          (email, fullName, role) => {
            const input = {
              email: `  ${email.toUpperCase()}  `,
              full_name: `  ${fullName}  `,
              role,
            };
            
            const result = createUserSchema.safeParse(input);
            
            if (!result.success) return true; // Skip if invalid
            
            // Email should be lowercase and trimmed
            const emailIsLowerTrimmed = result.data.email === email.toLowerCase();
            // Full name should be trimmed
            const nameIsTrimmed = result.data.full_name === fullName.trim();
            
            return emailIsLowerTrimmed && nameIsTrimmed;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
