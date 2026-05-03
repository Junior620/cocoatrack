# Satellite Imagery API Request Validation

This document describes the request validation implementation for the satellite imagery API endpoints.

## Overview

The satellite imagery API uses [Zod](https://zod.dev/) for runtime type validation and schema validation. All request parameters are validated before processing to ensure data integrity and provide clear error messages to API consumers.

## Validation Schema

### GET /api/satellite/imagery

**Location**: `lib/validations/satellite.ts`

#### Query Parameters

| Parameter | Type | Required | Validation Rules | Default |
|-----------|------|----------|------------------|---------|
| `parcelleId` | string (UUID) | Yes | Must be a valid UUID format | - |
| `date` | string (ISO 8601) | No | Must be ISO 8601 format (YYYY-MM-DD or full datetime) | Most recent |
| `cloudCoverThreshold` | number | No | Must be between 0 and 100 (inclusive) | 20 |

#### Validation Rules

##### parcelleId
- **Format**: UUID v4 format (e.g., `123e4567-e89b-12d3-a456-426614174000`)
- **Required**: Yes
- **Error Message**: "Invalid parcelle ID format. Must be a valid UUID"

##### date
- **Format**: ISO 8601 date or datetime
  - Date format: `YYYY-MM-DD` (e.g., `2024-05-03`)
  - Datetime format: `YYYY-MM-DDTHH:mm:ssZ` (e.g., `2024-05-03T12:00:00Z`)
- **Required**: No
- **Default Behavior**: Returns most recent available imagery
- **Error Message**: "Invalid date format. Must be ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)"

##### cloudCoverThreshold
- **Format**: Number (integer or decimal)
- **Range**: 0 to 100 (inclusive)
- **Required**: No
- **Default**: 20 (suitable for tropical regions like Cameroon)
- **Error Messages**:
  - Below 0: "Cloud cover threshold must be at least 0"
  - Above 100: "Cloud cover threshold must be at most 100"

## Usage Examples

### Valid Requests

```bash
# Minimal request (only required parameters)
GET /api/satellite/imagery?parcelleId=123e4567-e89b-12d3-a456-426614174000

# With date (YYYY-MM-DD format)
GET /api/satellite/imagery?parcelleId=123e4567-e89b-12d3-a456-426614174000&date=2024-05-03

# With date (full ISO 8601 format)
GET /api/satellite/imagery?parcelleId=123e4567-e89b-12d3-a456-426614174000&date=2024-05-03T12:00:00Z

# With cloud cover threshold
GET /api/satellite/imagery?parcelleId=123e4567-e89b-12d3-a456-426614174000&cloudCoverThreshold=30

# All parameters
GET /api/satellite/imagery?parcelleId=123e4567-e89b-12d3-a456-426614174000&date=2024-05-03&cloudCoverThreshold=30
```

### Invalid Requests

```bash
# Missing parcelleId (400 Bad Request)
GET /api/satellite/imagery

# Invalid UUID format (400 Bad Request)
GET /api/satellite/imagery?parcelleId=not-a-uuid

# Invalid date format (400 Bad Request)
GET /api/satellite/imagery?parcelleId=123e4567-e89b-12d3-a456-426614174000&date=05/03/2024

# Cloud cover threshold out of range (400 Bad Request)
GET /api/satellite/imagery?parcelleId=123e4567-e89b-12d3-a456-426614174000&cloudCoverThreshold=150
```

## Error Response Format

When validation fails, the API returns a `400 Bad Request` response with the following structure:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request parameters",
  "details": {
    "field": "parcelleId",
    "message": "Invalid parcelle ID format. Must be a valid UUID"
  }
}
```

### Error Response Fields

- `error`: Error code (always `"VALIDATION_ERROR"` for validation failures)
- `message`: High-level error description
- `details.field`: The parameter that failed validation
- `details.message`: Specific validation error message

## Implementation Details

### Validation Flow

1. **Extract Query Parameters**: Parse URL search parameters from the request
2. **Type Conversion**: Convert string parameters to appropriate types (e.g., `cloudCoverThreshold` to number)
3. **Schema Validation**: Validate against Zod schema
4. **Error Formatting**: Format validation errors for API response
5. **Success**: Return validated and typed data

### Helper Functions

#### `parseSatelliteImageryRequest(searchParams: URLSearchParams)`

Parses and validates query parameters from a Next.js request.

**Returns**:
- Success: `{ success: true, data: SatelliteImageryRequest }`
- Failure: `{ success: false, error: ZodError }`

**Example**:
```typescript
const searchParams = request.nextUrl.searchParams;
const parseResult = parseSatelliteImageryRequest(searchParams);

if (!parseResult.success) {
  // Handle validation error
  const { field, message } = formatValidationError(parseResult.error);
  return NextResponse.json({ error: 'VALIDATION_ERROR', details: { field, message } }, { status: 400 });
}

// Use validated data
const { parcelleId, date, cloudCoverThreshold } = parseResult.data;
```

#### `formatValidationError(error: ZodError)`

Formats a Zod validation error for API response.

**Returns**: `{ field: string, message: string }`

**Example**:
```typescript
const { field, message } = formatValidationError(parseResult.error);
// field: "parcelleId"
// message: "Invalid parcelle ID format. Must be a valid UUID"
```

## Testing

### Unit Tests

**Location**: `tests/validations/satellite.test.ts`

Tests cover:
- Valid UUID formats
- Invalid UUID formats
- Valid date formats (YYYY-MM-DD and ISO 8601 datetime)
- Invalid date formats
- Cloud cover threshold ranges (0, 50, 100)
- Out-of-range thresholds (-1, 101)
- Default values
- Missing optional parameters
- Combined validation scenarios

**Run tests**:
```bash
npm test -- tests/validations/satellite.test.ts
```

### Integration Tests

**Location**: `tests/api/satellite/imagery.test.ts`

Tests cover:
- Valid requests with all parameters
- Valid requests with only required parameters
- Invalid parcelleId format
- Missing parcelleId
- Invalid date format
- Out-of-range cloud cover threshold
- Clear error messages
- Edge cases (0, 100, different date formats)

**Run tests**:
```bash
npm test -- tests/api/satellite/imagery.test.ts
```

## Best Practices

### For API Consumers

1. **Always provide parcelleId**: This is a required parameter
2. **Use ISO 8601 date format**: Prefer `YYYY-MM-DD` for simplicity
3. **Handle validation errors**: Check for `400` status code and parse error details
4. **Use appropriate cloud cover threshold**: Default (20%) is suitable for tropical regions

### For Developers

1. **Validate early**: Validation happens before any business logic
2. **Provide clear error messages**: Include field name and specific validation rule
3. **Use type-safe schemas**: Zod provides runtime and compile-time type safety
4. **Test edge cases**: Include boundary values (0, 100) in tests
5. **Document validation rules**: Keep this document updated with schema changes

## Future Enhancements

Potential improvements for future iterations:

1. **Date range validation**: Ensure date is not in the future
2. **Parcelle existence check**: Validate that parcelleId exists in database
3. **Authorization validation**: Check user has access to the parcelle
4. **Rate limiting per parcelle**: Prevent excessive requests for the same parcelle
5. **Batch validation**: Support multiple parcelleIds in a single request

## Related Documentation

- [Satellite Imagery API](./api-endpoints.md)
- [Error Handling](./error-handling.md)
- [Testing Guide](./testing.md)
