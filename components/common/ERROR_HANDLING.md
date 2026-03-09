# Error Handling Implementation

## Overview

This document describes the error handling implementation for the bulk planteur assignment feature, addressing requirements 7.1, 7.4, and 7.5.

## Components

### 1. ErrorBoundary Component

**Location**: `v2/components/common/ErrorBoundary.tsx`

**Purpose**: Catches JavaScript errors anywhere in the child component tree and displays a fallback UI.

**Features**:
- Catches React errors in component tree
- Displays user-friendly error messages
- Provides retry functionality
- Supports custom fallback UI
- Logs errors in development mode
- Optional error callback for logging/monitoring

**Usage**:
```tsx
<ErrorBoundary
  fallback={(error, reset) => <CustomFallback error={error} reset={reset} />}
  onError={(error, errorInfo) => console.error(error)}
>
  <YourComponent />
</ErrorBoundary>
```

### 2. BulkAssignmentErrorFallback Component

**Location**: `v2/components/common/ErrorBoundary.tsx`

**Purpose**: Specialized error fallback for bulk assignment operations.

**Features**:
- Detects error type (network, timeout, database)
- Provides specific error messages and guidance
- Offers retry functionality
- User-friendly error presentation

**Error Types Handled**:
1. **Network Errors**: Connection failures, fetch errors
2. **Timeout Errors**: Operations exceeding time limits
3. **Database Errors**: Database connection or query failures

## Error Handling in BulkAssignmentDialog

### Loading Options Error Handling

**Requirement**: 7.1 - Handle database connection failures

**Implementation**:
- Try-catch block around API calls
- Specific error messages for different error types
- Retry button when loading fails
- Loading state management

**Error Types**:
- Network errors: "Erreur de connexion. Vérifiez votre connexion internet."
- Timeout errors: "Délai d'attente dépassé. Veuillez réessayer."
- Generic errors: Display the actual error message

### Assignment Submission Error Handling

**Requirements**: 
- 7.1 - Handle database connection failures
- 7.4 - Handle timeout errors
- 7.5 - Maintain selection state on error

**Implementation**:

1. **Timeout Handling** (Requirement 7.4):
   - 30-second timeout using AbortController
   - Specific error message for timeout
   - Guidance to retry with fewer planteurs

2. **Network Error Handling** (Requirement 7.1):
   - Detects fetch failures
   - User-friendly error messages
   - Retry guidance

3. **Database Error Handling** (Requirement 7.1):
   - Detects database-specific errors (PGRST codes)
   - Suggests waiting and retrying

4. **Selection State Preservation** (Requirement 7.5):
   - Selection state is NOT cleared on error
   - User can retry without re-selecting planteurs
   - Error message displayed in dialog
   - Confirmation dialog closed to allow form modification

## Error Flow

### Successful Flow
```
User submits → API call → Success → Clear selection → Close dialog → Show toast
```

### Error Flow
```
User submits → API call → Error → Show error message → Keep selection → Stay in dialog
                                                      ↓
                                              User can retry
```

## Testing Error Handling

### Manual Testing Scenarios

1. **Network Error**:
   - Disconnect internet
   - Try to load options or submit assignment
   - Verify error message and retry button

2. **Timeout Error**:
   - Select >100 planteurs
   - Mock slow API response (>30s)
   - Verify timeout error message

3. **Database Error**:
   - Stop database service
   - Try to submit assignment
   - Verify database error message

4. **Selection Preservation**:
   - Select planteurs
   - Trigger any error
   - Verify selection is maintained
   - Retry and verify selection still present

### Automated Testing

Error boundary testing requires React Testing Library, which is not currently installed. For now, error handling is verified through:
- TypeScript type checking
- Manual testing
- Code review

## Error Messages

All error messages are in French to match the application language:

- **Network Error**: "Erreur de connexion. Vérifiez votre connexion internet et réessayez."
- **Timeout Error**: "Délai d'attente dépassé. L'opération a pris trop de temps. Veuillez réessayer avec moins de planteurs."
- **Database Error**: "Erreur de base de données. Veuillez réessayer dans quelques instants."
- **Generic Error**: Display the actual error message from the exception

## Loading States

### Options Loading
- Skeleton UI with animated placeholders
- Loading text: "Chargement des options..."
- Disabled form controls during loading

### Assignment Submission
- Progress indicator for >100 planteurs
- Loading text: "Assignation en cours..."
- Disabled form controls during submission
- Spinner icon on submit button

## Best Practices

1. **Always wrap async operations in try-catch**
2. **Provide specific error messages based on error type**
3. **Maintain user state on error (don't clear selections)**
4. **Offer retry functionality**
5. **Use loading states to indicate progress**
6. **Disable controls during operations to prevent duplicate submissions**
7. **Log errors in development for debugging**

## Future Improvements

1. Install @testing-library/react for component testing
2. Add error logging service (e.g., Sentry) integration
3. Add retry with exponential backoff for transient errors
4. Add offline detection and queue operations
5. Add more granular error types and handling
