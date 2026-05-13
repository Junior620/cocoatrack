/**
 * GET /api/satellite/openapi
 *
 * Serves the OpenAPI 3.0 specification as JSON for the Satellite Imagery API.
 * Used by the interactive API docs page at /api-docs.
 */

import { NextResponse } from 'next/server';

const OPENAPI_SPEC = {
  openapi: '3.0.3',
  info: {
    title: 'CocoaTrack Satellite Imagery API',
    description:
      'API for satellite imagery analysis in CocoaTrack: NDVI, deforestation detection, temporal analysis, and yield prediction for cocoa parcelles.\n\n## Authentication\nAll endpoints require Supabase JWT via session cookie or `Authorization: Bearer <token>` header.\n\n## Rate Limiting\n100 requests/minute per user. Rate limit headers included in all responses.',
    version: '1.0.0',
    contact: {
      name: 'CocoaTrack Support',
      email: 'support@cocoatrack.com',
    },
  },
  servers: [
    {
      url: 'https://cocoatrack.com/api/satellite',
      description: 'Production',
    },
    {
      url: 'http://localhost:3000/api/satellite',
      description: 'Development',
    },
  ],
  tags: [
    { name: 'Imagery', description: 'Satellite imagery retrieval' },
    { name: 'NDVI', description: 'NDVI calculation and health status' },
    { name: 'Temporal', description: 'Temporal analysis and trend detection' },
    { name: 'Deforestation', description: 'Deforestation detection and alerts' },
    { name: 'Export', description: 'Data export (KML, CSV)' },
    { name: 'Reports', description: 'Certification and compliance reports' },
    { name: 'Yield', description: 'Yield prediction' },
    { name: 'Cache', description: 'Cache management' },
  ],
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  paths: {
    '/imagery': {
      get: {
        tags: ['Imagery'],
        summary: 'Retrieve satellite imagery',
        description:
          'Get the most recent cloud-free Sentinel-2 imagery for a parcelle, with optional date and cloud cover filtering.',
        operationId: 'getImagery',
        parameters: [
          {
            name: 'parcelleId',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'UUID of the parcelle',
          },
          {
            name: 'date',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'date-time' },
            description: 'Acquisition date (ISO 8601). Defaults to most recent.',
          },
          {
            name: 'cloudCoverThreshold',
            in: 'query',
            required: false,
            schema: { type: 'number', minimum: 0, maximum: 100, default: 20 },
            description: 'Maximum cloud cover percentage (0–100)',
          },
        ],
        responses: {
          '200': {
            description: 'Imagery data',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ImageryResponse' },
                example: {
                  imagery: {
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    parcelleId: '123e4567-e89b-12d3-a456-426614174000',
                    acquisitionDate: '2024-05-03T10:30:00Z',
                    cloudCoverPercent: 15.5,
                    satelliteSource: 'sentinel-2',
                    tileUrl: 'https://storage.supabase.co/satellite-tiles/...',
                    bounds: [-10.5, 5.2, -10.4, 5.3],
                    resolutionMeters: 10,
                    createdAt: '2024-05-03T11:00:00Z',
                  },
                  cached: true,
                  cacheAge: 3600000,
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/ImageryNotFound' },
          '429': { $ref: '#/components/responses/TooManyRequests' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/ndvi': {
      post: {
        tags: ['NDVI'],
        summary: 'Calculate NDVI',
        description:
          'Calculate NDVI using Sentinel-2 bands B8 (NIR) and B4 (Red). Formula: (NIR - Red) / (NIR + Red). Results are cached for 24 hours.',
        operationId: 'calculateNDVI',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/NDVIRequest' },
              example: {
                parcelleId: '123e4567-e89b-12d3-a456-426614174000',
                date: '2024-05-03T00:00:00Z',
                forceRecalculate: false,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'NDVI result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NDVIResponse' },
                example: {
                  success: true,
                  data: {
                    ndvi: {
                      id: '550e8400-e29b-41d4-a716-446655440000',
                      parcelleId: '123e4567-e89b-12d3-a456-426614174000',
                      calculationDate: '2024-05-03T00:00:00Z',
                      meanNDVI: 0.65,
                      minNDVI: 0.42,
                      maxNDVI: 0.83,
                      stdDevNDVI: 0.08,
                      healthStatus: 'good',
                      ndviRasterUrl: null,
                    },
                    cached: false,
                    recommendation: 'Vegetation is healthy. Continue regular monitoring.',
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '422': { $ref: '#/components/responses/InsufficientData' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/health-status/{parcelleId}': {
      get: {
        tags: ['NDVI'],
        summary: 'Get health status',
        description:
          'Retrieve current vegetation health status with NDVI value, 3-month trend, and agronomic recommendation.',
        operationId: 'getHealthStatus',
        parameters: [
          {
            name: 'parcelleId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'UUID of the parcelle',
          },
        ],
        responses: {
          '200': {
            description: 'Health status data',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthStatusResponse' },
                example: {
                  success: true,
                  data: {
                    parcelleId: '123e4567-e89b-12d3-a456-426614174000',
                    healthStatus: 'good',
                    meanNDVI: 0.65,
                    lastCalculationDate: '2024-05-03T00:00:00Z',
                    trend: { direction: 'improving', changeRate: 0.02, dataPoints: 5 },
                    recommendation: 'Vegetation is healthy. Continue regular monitoring.',
                    cached: true,
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NDVINotFound' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/temporal': {
      get: {
        tags: ['Temporal'],
        summary: 'Get temporal analysis',
        description:
          'Retrieve NDVI timeline over a date range with trend analysis and significant change detection.',
        operationId: 'getTemporalAnalysis',
        parameters: [
          {
            name: 'parcelleId',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'startDate',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date' },
            example: '2023-01-01',
          },
          {
            name: 'endDate',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date' },
            example: '2024-01-01',
          },
          {
            name: 'interval',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['daily', 'weekly', 'monthly'], default: 'monthly' },
          },
        ],
        responses: {
          '200': {
            description: 'Temporal analysis data',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TemporalResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '422': { $ref: '#/components/responses/InsufficientData' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/deforestation': {
      get: {
        tags: ['Deforestation'],
        summary: 'Get deforestation alerts',
        description:
          'Retrieve deforestation alerts for a parcelle with EUDR compliance status.',
        operationId: 'getDeforestationAlerts',
        parameters: [
          {
            name: 'parcelleId',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['pending', 'acknowledged', 'disputed', 'resolved'],
            },
          },
        ],
        responses: {
          '200': {
            description: 'Deforestation alerts',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DeforestationResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/deforestation/check': {
      post: {
        tags: ['Deforestation'],
        summary: 'Check for deforestation',
        description:
          'Trigger deforestation detection by comparing NDVI against the EUDR baseline (Dec 31, 2020). Flags events where NDVI decrease > 0.3 over area > 0.5 ha.',
        operationId: 'checkDeforestation',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DeforestationCheckRequest' },
              example: {
                parcelleId: '123e4567-e89b-12d3-a456-426614174000',
                baselineDate: '2020-12-31',
                currentDate: '2024-05-03',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Detection results',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DeforestationResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/export/kml': {
      post: {
        tags: ['Export'],
        summary: 'Export as KML',
        description:
          'Export parcelle data with satellite analysis as KML/KMZ file for Google Earth. Supports batch export of up to 100 parcelles.',
        operationId: 'exportKML',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/KMLExportRequest' },
              example: {
                parcelleIds: ['123e4567-e89b-12d3-a456-426614174000'],
                options: {
                  includeTemporal: false,
                  includeNDVI: true,
                  includeDeforestation: true,
                  format: 'kml',
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'KML file',
            content: {
              'application/vnd.google-earth.kml+xml': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/export/csv': {
      post: {
        tags: ['Export'],
        summary: 'Export temporal data as CSV',
        description: 'Export temporal NDVI data as CSV with date, NDVI values, and change metrics.',
        operationId: 'exportCSV',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CSVExportRequest' },
              example: {
                parcelleId: '123e4567-e89b-12d3-a456-426614174000',
                startDate: '2023-01-01',
                endDate: '2024-01-01',
                interval: 'monthly',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'CSV file',
            content: {
              'text/csv': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supabase JWT token',
      },
      CookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'sb-access-token',
        description: 'Supabase session cookie',
      },
    },
    schemas: {
      ImageryData: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          parcelleId: { type: 'string', format: 'uuid' },
          acquisitionDate: { type: 'string', format: 'date-time' },
          cloudCoverPercent: { type: 'number', minimum: 0, maximum: 100 },
          satelliteSource: { type: 'string', enum: ['sentinel-2'] },
          tileUrl: { type: 'string', format: 'uri' },
          bounds: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4 },
          resolutionMeters: { type: 'number' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ImageryResponse: {
        type: 'object',
        properties: {
          imagery: { $ref: '#/components/schemas/ImageryData' },
          cached: { type: 'boolean' },
          cacheAge: { type: 'number', description: 'Age of cached data in milliseconds' },
        },
      },
      NDVIRequest: {
        type: 'object',
        required: ['parcelleId'],
        properties: {
          parcelleId: { type: 'string', format: 'uuid' },
          date: { type: 'string', format: 'date-time' },
          forceRecalculate: { type: 'boolean', default: false },
        },
      },
      NDVIResult: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          parcelleId: { type: 'string', format: 'uuid' },
          calculationDate: { type: 'string', format: 'date-time' },
          meanNDVI: { type: 'number', minimum: -1, maximum: 1 },
          minNDVI: { type: 'number', minimum: -1, maximum: 1 },
          maxNDVI: { type: 'number', minimum: -1, maximum: 1 },
          stdDevNDVI: { type: 'number' },
          healthStatus: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor', 'critical'] },
          ndviRasterUrl: { type: 'string', format: 'uri', nullable: true },
        },
      },
      NDVIResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              ndvi: { $ref: '#/components/schemas/NDVIResult' },
              cached: { type: 'boolean' },
              recommendation: { type: 'string' },
            },
          },
        },
      },
      HealthStatusResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              parcelleId: { type: 'string', format: 'uuid' },
              healthStatus: {
                type: 'string',
                enum: ['excellent', 'good', 'fair', 'poor', 'critical'],
              },
              meanNDVI: { type: 'number' },
              lastCalculationDate: { type: 'string', format: 'date-time' },
              trend: {
                type: 'object',
                nullable: true,
                properties: {
                  direction: { type: 'string', enum: ['improving', 'stable', 'declining'] },
                  changeRate: { type: 'number' },
                  dataPoints: { type: 'integer' },
                },
              },
              recommendation: { type: 'string' },
              cached: { type: 'boolean' },
            },
          },
        },
      },
      TemporalDataPoint: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date-time' },
          ndvi: { type: 'number' },
          cloudCover: { type: 'number' },
          healthStatus: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor', 'critical'] },
          hasSignificantChange: { type: 'boolean' },
        },
      },
      TemporalResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              parcelleId: { type: 'string', format: 'uuid' },
              startDate: { type: 'string', format: 'date-time' },
              endDate: { type: 'string', format: 'date-time' },
              interval: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
              summary: {
                type: 'object',
                properties: {
                  timeline: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/TemporalDataPoint' },
                  },
                  trend: { type: 'object', nullable: true },
                  significantChanges: { type: 'integer' },
                  averageNDVI: { type: 'number' },
                },
              },
            },
          },
        },
      },
      DeforestationEvent: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          parcelleId: { type: 'string', format: 'uuid' },
          baselineDate: { type: 'string', format: 'date-time' },
          detectionDate: { type: 'string', format: 'date-time' },
          baselineNDVI: { type: 'number' },
          currentNDVI: { type: 'number' },
          ndviChange: { type: 'number', description: 'Negative value indicates vegetation loss' },
          affectedAreaHectares: { type: 'number' },
          affectedAreaPercent: { type: 'number' },
          status: { type: 'string', enum: ['pending', 'acknowledged', 'disputed', 'resolved'] },
        },
      },
      DeforestationResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              alerts: {
                type: 'array',
                items: { $ref: '#/components/schemas/DeforestationEvent' },
              },
              compliant: { type: 'boolean', description: 'EUDR compliance status' },
              summary: {
                type: 'object',
                properties: {
                  totalAlerts: { type: 'integer' },
                  pendingAlerts: { type: 'integer' },
                  acknowledgedAlerts: { type: 'integer' },
                  disputedAlerts: { type: 'integer' },
                },
              },
            },
          },
        },
      },
      DeforestationCheckRequest: {
        type: 'object',
        required: ['parcelleId'],
        properties: {
          parcelleId: { type: 'string', format: 'uuid' },
          baselineDate: { type: 'string', format: 'date', default: '2020-12-31' },
          currentDate: { type: 'string', format: 'date' },
        },
      },
      KMLExportRequest: {
        type: 'object',
        required: ['parcelleIds', 'options'],
        properties: {
          parcelleIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            maxItems: 100,
          },
          options: {
            type: 'object',
            required: ['includeTemporal', 'includeNDVI', 'includeDeforestation', 'format'],
            properties: {
              includeTemporal: { type: 'boolean' },
              includeNDVI: { type: 'boolean' },
              includeDeforestation: { type: 'boolean' },
              startDate: { type: 'string', format: 'date' },
              endDate: { type: 'string', format: 'date' },
              format: { type: 'string', enum: ['kml', 'kmz'] },
            },
          },
        },
      },
      CSVExportRequest: {
        type: 'object',
        required: ['parcelleId', 'startDate', 'endDate'],
        properties: {
          parcelleId: { type: 'string', format: 'uuid' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          interval: { type: 'string', enum: ['daily', 'weekly', 'monthly'], default: 'monthly' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          message: { type: 'string' },
          details: { type: 'object' },
        },
      },
    },
    responses: {
      BadRequest: {
        description: 'Invalid request parameters',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'VALIDATION_ERROR', message: 'Invalid parcelle ID format' },
          },
        },
      },
      Unauthorized: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'UNAUTHORIZED', message: 'Authentication required' },
          },
        },
      },
      Forbidden: {
        description: 'Access denied',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'FORBIDDEN', message: 'You do not have permission to access this parcelle' },
          },
        },
      },
      ImageryNotFound: {
        description: 'Imagery not available',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'IMAGERY_UNAVAILABLE', message: 'No cloud-free imagery available within threshold' },
          },
        },
      },
      NDVINotFound: {
        description: 'NDVI data not found — calculate NDVI first',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'NDVI_NOT_FOUND', message: 'No NDVI data available. Please calculate NDVI first.' },
          },
        },
      },
      InsufficientData: {
        description: 'Insufficient data for analysis',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'INSUFFICIENT_DATA', message: 'Not enough data points for analysis' },
          },
        },
      },
      TooManyRequests: {
        description: 'Rate limit exceeded (100 req/min)',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again later.', retryAfter: 60 },
          },
        },
      },
      InternalError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
          },
        },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(OPENAPI_SPEC, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
