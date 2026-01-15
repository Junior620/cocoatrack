/**
 * CocoaTrack V2 - Property Tests for Admin User Creation
 * 
 * Tests for Feature: admin-user-management
 * 
 * Properties tested:
 * - Property 2: Authorization Enforcement
 * - Property 5: Audit Trail
 * 
 * **Validates: Requirements 5.1, 5.3, 5.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { USER_ROLES, type UserRole } from '@/lib/validations/user';

// ============================================================================
// AUTHORIZATION LOGIC (Pure functions extracted for testing)
// ============================================================================

/**
 * Check if a user role is authorized to create users
 * Only admin role can create users (Requirement 5.1)
 */
export function isAuthorizedToCreateUser(role: UserRole | null | undefined): boolean {
  return role === 'admin';
}

/**
 * Determine the HTTP status code for an authorization check
 * Returns 403 for unauthorized users (Requirement 5.4)
 */
export function getAuthorizationStatus(
  isAuthenticated: boolean,
  role: UserRole | null | undefined
): { authorized: boolean; statusCode: number; message: string } {
  if (!isAuthenticated) {
    return {
      authorized: false,
      statusCode: 401,
      message: 'Non authentifié',
    };
  }

  if (!isAuthorizedToCreateUser(role)) {
    return {
      authorized: false,
      statusCode: 403,
      message: 'Accès non autorisé',
    };
  }

  return {
    authorized: true,
    statusCode: 200,
    message: 'Autorisé',
  };
}

/**
 * Simulate authorization check for user creation request
 */
export function checkUserCreationAuthorization(
  requestingUser: { isAuthenticated: boolean; role: UserRole | null } | null
): { authorized: boolean; statusCode: number; message: string } {
  if (!requestingUser) {
    return {
      authorized: false,
      statusCode: 401,
      message: 'Non authentifié',
    };
  }

  return getAuthorizationStatus(requestingUser.isAuthenticated, requestingUser.role);
}

// ============================================================================
// GENERATORS
// ============================================================================

// All valid user roles
const validRoleArb = fc.constantFrom(...USER_ROLES);

// Non-admin roles only
const nonAdminRoleArb = fc.constantFrom(
  ...USER_ROLES.filter((r) => r !== 'admin')
);

// Authenticated user with any role
const authenticatedUserArb = fc.record({
  isAuthenticated: fc.constant(true),
  role: validRoleArb,
});

// Authenticated admin user
const adminUserArb = fc.record({
  isAuthenticated: fc.constant(true),
  role: fc.constant('admin' as UserRole),
});

// Authenticated non-admin user
const nonAdminUserArb = fc.record({
  isAuthenticated: fc.constant(true),
  role: nonAdminRoleArb,
});

// Unauthenticated user (null or not authenticated)
const unauthenticatedUserArb = fc.oneof(
  fc.constant(null),
  fc.record({
    isAuthenticated: fc.constant(false),
    role: fc.oneof(validRoleArb, fc.constant(null)),
  })
);

// ============================================================================
// PROPERTY TESTS
// ============================================================================

describe('Feature: admin-user-management, Property 2: Authorization Enforcement', () => {
  /**
   * **Feature: admin-user-management, Property 2: Authorization Enforcement**
   * **Validates: Requirements 5.1, 5.4**
   * 
   * *For any* API request to create a user, if the requesting user does not 
   * have the 'admin' role, the system SHALL return a 403 Forbidden error.
   */

  describe('Admin Authorization (Requirement 5.1)', () => {
    it('should authorize admin users to create users', () => {
      // Feature: admin-user-management, Property 2: Authorization Enforcement
      // Validates: Requirements 5.1, 5.4
      fc.assert(
        fc.property(adminUserArb, (user) => {
          const result = checkUserCreationAuthorization(user);
          
          // Admin users should be authorized
          expect(result.authorized).toBe(true);
          expect(result.statusCode).toBe(200);
        }),
        { numRuns: 100 }
      );
    });

    it('should deny non-admin users from creating users', () => {
      // Feature: admin-user-management, Property 2: Authorization Enforcement
      // Validates: Requirements 5.1, 5.4
      fc.assert(
        fc.property(nonAdminUserArb, (user) => {
          const result = checkUserCreationAuthorization(user);
          
          // Non-admin users should be denied with 403
          expect(result.authorized).toBe(false);
          expect(result.statusCode).toBe(403);
          expect(result.message).toBe('Accès non autorisé');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Unauthenticated Access (Requirement 5.4)', () => {
    it('should deny unauthenticated requests with 401', () => {
      // Feature: admin-user-management, Property 2: Authorization Enforcement
      // Validates: Requirements 5.1, 5.4
      fc.assert(
        fc.property(unauthenticatedUserArb, (user) => {
          const result = checkUserCreationAuthorization(user);
          
          // Unauthenticated users should get 401
          expect(result.authorized).toBe(false);
          expect(result.statusCode).toBe(401);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Role-Based Authorization', () => {
    it('should only authorize admin role, not any other role', () => {
      // Feature: admin-user-management, Property 2: Authorization Enforcement
      // Validates: Requirements 5.1, 5.4
      fc.assert(
        fc.property(validRoleArb, (role) => {
          const isAuthorized = isAuthorizedToCreateUser(role);
          
          // Only admin should be authorized
          if (role === 'admin') {
            expect(isAuthorized).toBe(true);
          } else {
            expect(isAuthorized).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should return correct status codes for each role', () => {
      // Feature: admin-user-management, Property 2: Authorization Enforcement
      // Validates: Requirements 5.1, 5.4
      fc.assert(
        fc.property(authenticatedUserArb, (user) => {
          const result = checkUserCreationAuthorization(user);
          
          if (user.role === 'admin') {
            // Admin gets 200
            expect(result.statusCode).toBe(200);
            expect(result.authorized).toBe(true);
          } else {
            // Non-admin gets 403
            expect(result.statusCode).toBe(403);
            expect(result.authorized).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle null role as unauthorized', () => {
      // Feature: admin-user-management, Property 2: Authorization Enforcement
      // Validates: Requirements 5.1, 5.4
      const result = isAuthorizedToCreateUser(null);
      expect(result).toBe(false);
    });

    it('should handle undefined role as unauthorized', () => {
      // Feature: admin-user-management, Property 2: Authorization Enforcement
      // Validates: Requirements 5.1, 5.4
      const result = isAuthorizedToCreateUser(undefined);
      expect(result).toBe(false);
    });

    it('should consistently return 403 for all non-admin authenticated users', () => {
      // Feature: admin-user-management, Property 2: Authorization Enforcement
      // Validates: Requirements 5.1, 5.4
      const nonAdminRoles: UserRole[] = ['manager', 'agent', 'viewer'];
      
      for (const role of nonAdminRoles) {
        const result = getAuthorizationStatus(true, role);
        expect(result.statusCode).toBe(403);
        expect(result.authorized).toBe(false);
        expect(result.message).toBe('Accès non autorisé');
      }
    });
  });

  describe('Authorization Invariants', () => {
    it('should maintain authorization invariant: only admin can create users', () => {
      // Feature: admin-user-management, Property 2: Authorization Enforcement
      // Validates: Requirements 5.1, 5.4
      fc.assert(
        fc.property(
          fc.record({
            isAuthenticated: fc.boolean(),
            role: fc.oneof(validRoleArb, fc.constant(null)),
          }),
          (user) => {
            const result = checkUserCreationAuthorization(user);
            
            // Invariant: authorized iff (authenticated AND admin)
            const expectedAuthorized = user.isAuthenticated && user.role === 'admin';
            expect(result.authorized).toBe(expectedAuthorized);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return appropriate status codes based on authentication and role', () => {
      // Feature: admin-user-management, Property 2: Authorization Enforcement
      // Validates: Requirements 5.1, 5.4
      fc.assert(
        fc.property(
          fc.record({
            isAuthenticated: fc.boolean(),
            role: fc.oneof(validRoleArb, fc.constant(null)),
          }),
          (user) => {
            const result = checkUserCreationAuthorization(user);
            
            if (!user.isAuthenticated) {
              // Not authenticated -> 401
              expect(result.statusCode).toBe(401);
            } else if (user.role !== 'admin') {
              // Authenticated but not admin -> 403
              expect(result.statusCode).toBe(403);
            } else {
              // Authenticated admin -> 200
              expect(result.statusCode).toBe(200);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// ============================================================================
// AUDIT TRAIL TYPES AND LOGIC (Property 5)
// ============================================================================

/**
 * Audit log entry structure for user creation
 */
interface UserCreationAuditEntry {
  actor_id: string;
  actor_type: 'user' | 'system';
  table_name: string;
  row_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
}

/**
 * User creation data that should be logged
 */
interface UserCreationData {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  cooperative_id: string | null;
  created_by_admin: string;
}

/**
 * Create an audit log entry for user creation
 * This mirrors the audit logging in the API route
 */
export function createUserCreationAuditEntry(
  adminId: string,
  newUserId: string,
  userData: Omit<UserCreationData, 'id' | 'created_by_admin'>,
  ipAddress: string | null
): UserCreationAuditEntry {
  return {
    actor_id: adminId,
    actor_type: 'user',
    table_name: 'profiles',
    row_id: newUserId,
    action: 'INSERT',
    old_data: null,
    new_data: {
      id: newUserId,
      email: userData.email,
      full_name: userData.full_name,
      role: userData.role,
      cooperative_id: userData.cooperative_id,
      created_by_admin: adminId,
    },
    ip_address: ipAddress,
  };
}

/**
 * Validate that an audit entry correctly captures a user creation
 */
export function validateUserCreationAuditEntry(
  entry: UserCreationAuditEntry,
  expectedAdminId: string,
  expectedNewUserId: string,
  expectedUserData: Omit<UserCreationData, 'id' | 'created_by_admin'>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Property 5.1: actor_id must be the admin who created the user
  if (entry.actor_id !== expectedAdminId) {
    errors.push(`actor_id mismatch: expected ${expectedAdminId}, got ${entry.actor_id}`);
  }

  // Property 5.2: table_name must be 'profiles'
  if (entry.table_name !== 'profiles') {
    errors.push(`table_name mismatch: expected 'profiles', got '${entry.table_name}'`);
  }

  // Property 5.3: row_id must be the new user's ID
  if (entry.row_id !== expectedNewUserId) {
    errors.push(`row_id mismatch: expected ${expectedNewUserId}, got ${entry.row_id}`);
  }

  // Property 5.4: action must be 'INSERT'
  if (entry.action !== 'INSERT') {
    errors.push(`action mismatch: expected 'INSERT', got '${entry.action}'`);
  }

  // Property 5.5: old_data must be null for INSERT
  if (entry.old_data !== null) {
    errors.push('old_data should be null for INSERT action');
  }

  // Property 5.6: new_data must contain the user data
  if (entry.new_data === null) {
    errors.push('new_data should not be null');
  } else {
    const newData = entry.new_data as Record<string, unknown>;
    
    if (newData.id !== expectedNewUserId) {
      errors.push(`new_data.id mismatch: expected ${expectedNewUserId}, got ${newData.id}`);
    }
    if (newData.email !== expectedUserData.email) {
      errors.push(`new_data.email mismatch: expected ${expectedUserData.email}, got ${newData.email}`);
    }
    if (newData.full_name !== expectedUserData.full_name) {
      errors.push(`new_data.full_name mismatch: expected ${expectedUserData.full_name}, got ${newData.full_name}`);
    }
    if (newData.role !== expectedUserData.role) {
      errors.push(`new_data.role mismatch: expected ${expectedUserData.role}, got ${newData.role}`);
    }
    if (newData.created_by_admin !== expectedAdminId) {
      errors.push(`new_data.created_by_admin mismatch: expected ${expectedAdminId}, got ${newData.created_by_admin}`);
    }
  }

  // Property 5.7: actor_type must be 'user' (admin is a user)
  if (entry.actor_type !== 'user') {
    errors.push(`actor_type mismatch: expected 'user', got '${entry.actor_type}'`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if an audit entry is valid for user creation
 */
export function isValidUserCreationAuditEntry(entry: UserCreationAuditEntry): boolean {
  // Must have actor_id (admin who created)
  if (!entry.actor_id) return false;
  
  // Must be for profiles table
  if (entry.table_name !== 'profiles') return false;
  
  // Must be INSERT action
  if (entry.action !== 'INSERT') return false;
  
  // Must have row_id (new user id)
  if (!entry.row_id) return false;
  
  // Must have new_data
  if (!entry.new_data) return false;
  
  // old_data must be null for INSERT
  if (entry.old_data !== null) return false;
  
  // actor_type must be 'user'
  if (entry.actor_type !== 'user') return false;
  
  return true;
}

// ============================================================================
// AUDIT TRAIL GENERATORS
// ============================================================================

// Generate valid email
const emailArb = fc.emailAddress();

// Generate valid full name (at least 2 characters)
const fullNameArb = fc.string({ minLength: 2, maxLength: 100 })
  .filter(s => s.trim().length >= 2);

// Generate IP address
const ipAddressArb = fc.oneof(
  fc.tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  ).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`),
  fc.constant(null)
);

// Generate user creation data
const userCreationDataArb = fc.record({
  email: emailArb,
  full_name: fullNameArb,
  role: fc.constantFrom(...USER_ROLES),
  cooperative_id: fc.oneof(fc.uuid(), fc.constant(null)),
});

// ============================================================================
// PROPERTY 5: AUDIT TRAIL TESTS
// ============================================================================

describe('Feature: admin-user-management, Property 5: Audit Trail', () => {
  /**
   * **Feature: admin-user-management, Property 5: Audit Trail**
   * **Validates: Requirements 5.3**
   * 
   * *For any* successful user creation, the system SHALL create an audit log entry
   * with action='INSERT', table_name='profiles', and the actor_id of the admin
   * who created the user.
   */

  describe('Audit Entry Structure (Requirement 5.3)', () => {
    it('should create audit entry with correct actor_id (admin who created)', () => {
      // Feature: admin-user-management, Property 5: Audit Trail
      // Validates: Requirements 5.3
      fc.assert(
        fc.property(
          fc.uuid(), // adminId
          fc.uuid(), // newUserId
          userCreationDataArb,
          ipAddressArb,
          (adminId, newUserId, userData, ipAddress) => {
            const entry = createUserCreationAuditEntry(adminId, newUserId, userData, ipAddress);
            
            // actor_id must be the admin who created the user
            expect(entry.actor_id).toBe(adminId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create audit entry with table_name="profiles"', () => {
      // Feature: admin-user-management, Property 5: Audit Trail
      // Validates: Requirements 5.3
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          userCreationDataArb,
          ipAddressArb,
          (adminId, newUserId, userData, ipAddress) => {
            const entry = createUserCreationAuditEntry(adminId, newUserId, userData, ipAddress);
            
            // table_name must be 'profiles'
            expect(entry.table_name).toBe('profiles');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create audit entry with action="INSERT"', () => {
      // Feature: admin-user-management, Property 5: Audit Trail
      // Validates: Requirements 5.3
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          userCreationDataArb,
          ipAddressArb,
          (adminId, newUserId, userData, ipAddress) => {
            const entry = createUserCreationAuditEntry(adminId, newUserId, userData, ipAddress);
            
            // action must be 'INSERT'
            expect(entry.action).toBe('INSERT');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create audit entry with row_id matching new user ID', () => {
      // Feature: admin-user-management, Property 5: Audit Trail
      // Validates: Requirements 5.3
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          userCreationDataArb,
          ipAddressArb,
          (adminId, newUserId, userData, ipAddress) => {
            const entry = createUserCreationAuditEntry(adminId, newUserId, userData, ipAddress);
            
            // row_id must be the new user's ID
            expect(entry.row_id).toBe(newUserId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create audit entry with actor_type="user"', () => {
      // Feature: admin-user-management, Property 5: Audit Trail
      // Validates: Requirements 5.3
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          userCreationDataArb,
          ipAddressArb,
          (adminId, newUserId, userData, ipAddress) => {
            const entry = createUserCreationAuditEntry(adminId, newUserId, userData, ipAddress);
            
            // actor_type must be 'user' (admin is a user)
            expect(entry.actor_type).toBe('user');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Audit Entry Data (Requirement 5.3)', () => {
    it('should have null old_data for INSERT action', () => {
      // Feature: admin-user-management, Property 5: Audit Trail
      // Validates: Requirements 5.3
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          userCreationDataArb,
          ipAddressArb,
          (adminId, newUserId, userData, ipAddress) => {
            const entry = createUserCreationAuditEntry(adminId, newUserId, userData, ipAddress);
            
            // old_data must be null for INSERT
            expect(entry.old_data).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should capture user data in new_data', () => {
      // Feature: admin-user-management, Property 5: Audit Trail
      // Validates: Requirements 5.3
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          userCreationDataArb,
          ipAddressArb,
          (adminId, newUserId, userData, ipAddress) => {
            const entry = createUserCreationAuditEntry(adminId, newUserId, userData, ipAddress);
            
            // new_data must contain the user data
            expect(entry.new_data).not.toBeNull();
            const newData = entry.new_data as Record<string, unknown>;
            expect(newData.id).toBe(newUserId);
            expect(newData.email).toBe(userData.email);
            expect(newData.full_name).toBe(userData.full_name);
            expect(newData.role).toBe(userData.role);
            expect(newData.cooperative_id).toBe(userData.cooperative_id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should capture created_by_admin in new_data', () => {
      // Feature: admin-user-management, Property 5: Audit Trail
      // Validates: Requirements 5.3
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          userCreationDataArb,
          ipAddressArb,
          (adminId, newUserId, userData, ipAddress) => {
            const entry = createUserCreationAuditEntry(adminId, newUserId, userData, ipAddress);
            
            // new_data must contain created_by_admin
            const newData = entry.new_data as Record<string, unknown>;
            expect(newData.created_by_admin).toBe(adminId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should capture IP address when provided', () => {
      // Feature: admin-user-management, Property 5: Audit Trail
      // Validates: Requirements 5.3
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          userCreationDataArb,
          ipAddressArb,
          (adminId, newUserId, userData, ipAddress) => {
            const entry = createUserCreationAuditEntry(adminId, newUserId, userData, ipAddress);
            
            // ip_address should match input
            expect(entry.ip_address).toBe(ipAddress);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Audit Entry Validation', () => {
    it('should pass validation for correctly formed audit entries', () => {
      // Feature: admin-user-management, Property 5: Audit Trail
      // Validates: Requirements 5.3
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          userCreationDataArb,
          ipAddressArb,
          (adminId, newUserId, userData, ipAddress) => {
            const entry = createUserCreationAuditEntry(adminId, newUserId, userData, ipAddress);
            const validation = validateUserCreationAuditEntry(entry, adminId, newUserId, userData);
            
            expect(validation.valid).toBe(true);
            expect(validation.errors).toEqual([]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should identify valid user creation audit entries', () => {
      // Feature: admin-user-management, Property 5: Audit Trail
      // Validates: Requirements 5.3
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          userCreationDataArb,
          ipAddressArb,
          (adminId, newUserId, userData, ipAddress) => {
            const entry = createUserCreationAuditEntry(adminId, newUserId, userData, ipAddress);
            
            expect(isValidUserCreationAuditEntry(entry)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Audit Trail Invariants', () => {
    it('should maintain invariant: audit entry always references the admin actor', () => {
      // Feature: admin-user-management, Property 5: Audit Trail
      // Validates: Requirements 5.3
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          userCreationDataArb,
          ipAddressArb,
          (adminId, newUserId, userData, ipAddress) => {
            const entry = createUserCreationAuditEntry(adminId, newUserId, userData, ipAddress);
            
            // Invariant: actor_id === adminId AND new_data.created_by_admin === adminId
            expect(entry.actor_id).toBe(adminId);
            expect((entry.new_data as Record<string, unknown>).created_by_admin).toBe(adminId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain invariant: audit entry always references the new user', () => {
      // Feature: admin-user-management, Property 5: Audit Trail
      // Validates: Requirements 5.3
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          userCreationDataArb,
          ipAddressArb,
          (adminId, newUserId, userData, ipAddress) => {
            const entry = createUserCreationAuditEntry(adminId, newUserId, userData, ipAddress);
            
            // Invariant: row_id === newUserId AND new_data.id === newUserId
            expect(entry.row_id).toBe(newUserId);
            expect((entry.new_data as Record<string, unknown>).id).toBe(newUserId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain invariant: INSERT action always has null old_data and non-null new_data', () => {
      // Feature: admin-user-management, Property 5: Audit Trail
      // Validates: Requirements 5.3
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          userCreationDataArb,
          ipAddressArb,
          (adminId, newUserId, userData, ipAddress) => {
            const entry = createUserCreationAuditEntry(adminId, newUserId, userData, ipAddress);
            
            // Invariant for INSERT: old_data === null AND new_data !== null
            expect(entry.action).toBe('INSERT');
            expect(entry.old_data).toBeNull();
            expect(entry.new_data).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
