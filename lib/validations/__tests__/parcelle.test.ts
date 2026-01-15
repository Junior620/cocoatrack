/**
 * CocoaTrack V2 - Unit Tests for Parcelle Validation Schemas
 * 
 * Tests for createParcelleSchema with geometry validation
 */

import { describe, it, expect } from 'vitest';

import {
  createParcelleSchema,
  validateGeometryCoordinates,
  detectProjectedCoordinates,
  conformityStatusSchema,
  certificationSchema,
  geometrySchema,
} from '../parcelle';

describe('createParcelleSchema', () => {
  describe('valid inputs', () => {
    it('should accept valid parcelle with Polygon geometry', () => {
      const input = {
        planteur_id: '123e4567-e89b-12d3-a456-426614174000',
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        },
        code: 'PARC-001',
        label: 'Test Parcelle',
        certifications: ['rainforest_alliance', 'bio'],
      };

      const result = createParcelleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept valid parcelle with MultiPolygon geometry', () => {
      const input = {
        planteur_id: '123e4567-e89b-12d3-a456-426614174000',
        geometry: {
          type: 'MultiPolygon' as const,
          coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]],
        },
      };

      const result = createParcelleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept parcelle with minimal required fields', () => {
      const input = {
        planteur_id: '123e4567-e89b-12d3-a456-426614174000',
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        },
      };

      const result = createParcelleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept polygon with holes (interior rings)', () => {
      const input = {
        planteur_id: '123e4567-e89b-12d3-a456-426614174000',
        geometry: {
          type: 'Polygon' as const,
          coordinates: [
            // Exterior ring
            [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
            // Interior ring (hole)
            [[2, 2], [2, 8], [8, 8], [8, 2], [2, 2]],
          ],
        },
      };

      const result = createParcelleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept all valid certifications', () => {
      const input = {
        planteur_id: '123e4567-e89b-12d3-a456-426614174000',
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        },
        certifications: ['rainforest_alliance', 'utz', 'fairtrade', 'bio', 'organic', 'other'],
      };

      const result = createParcelleSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should set default conformity_status to informations_manquantes', () => {
      const input = {
        planteur_id: '123e4567-e89b-12d3-a456-426614174000',
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        },
      };

      const result = createParcelleSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.conformity_status).toBe('informations_manquantes');
      }
    });
  });

  describe('invalid inputs', () => {
    it('should reject missing planteur_id', () => {
      const input = {
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        },
      };

      const result = createParcelleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid planteur_id (not UUID)', () => {
      const input = {
        planteur_id: 'not-a-uuid',
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        },
      };

      const result = createParcelleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject missing geometry', () => {
      const input = {
        planteur_id: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = createParcelleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject unclosed ring', () => {
      const input = {
        planteur_id: '123e4567-e89b-12d3-a456-426614174000',
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]], // Not closed
        },
      };

      const result = createParcelleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject ring with less than 4 positions', () => {
      const input = {
        planteur_id: '123e4567-e89b-12d3-a456-426614174000',
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[0, 0], [1, 0], [0, 0]]], // Only 3 positions
        },
      };

      const result = createParcelleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject longitude out of bounds (> 180)', () => {
      const input = {
        planteur_id: '123e4567-e89b-12d3-a456-426614174000',
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[200, 0], [201, 0], [201, 1], [200, 1], [200, 0]]],
        },
      };

      const result = createParcelleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject longitude out of bounds (< -180)', () => {
      const input = {
        planteur_id: '123e4567-e89b-12d3-a456-426614174000',
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[-200, 0], [-199, 0], [-199, 1], [-200, 1], [-200, 0]]],
        },
      };

      const result = createParcelleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject latitude out of bounds (> 90)', () => {
      const input = {
        planteur_id: '123e4567-e89b-12d3-a456-426614174000',
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[0, 100], [1, 100], [1, 101], [0, 101], [0, 100]]],
        },
      };

      const result = createParcelleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject latitude out of bounds (< -90)', () => {
      const input = {
        planteur_id: '123e4567-e89b-12d3-a456-426614174000',
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[0, -100], [1, -100], [1, -99], [0, -99], [0, -100]]],
        },
      };

      const result = createParcelleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid certification', () => {
      const input = {
        planteur_id: '123e4567-e89b-12d3-a456-426614174000',
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        },
        certifications: ['invalid_cert'],
      };

      const result = createParcelleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid conformity_status', () => {
      const input = {
        planteur_id: '123e4567-e89b-12d3-a456-426614174000',
        geometry: {
          type: 'Polygon' as const,
          coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        },
        conformity_status: 'invalid_status',
      };

      const result = createParcelleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject unsupported geometry type', () => {
      const input = {
        planteur_id: '123e4567-e89b-12d3-a456-426614174000',
        geometry: {
          type: 'Point' as const,
          coordinates: [0, 0],
        },
      };

      const result = createParcelleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty polygon (no rings)', () => {
      const input = {
        planteur_id: '123e4567-e89b-12d3-a456-426614174000',
        geometry: {
          type: 'Polygon' as const,
          coordinates: [],
        },
      };

      const result = createParcelleSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});

describe('validateGeometryCoordinates', () => {
  it('should return valid for WGS84 coordinates', () => {
    const geometry = {
      type: 'Polygon' as const,
      coordinates: [[[-5.5, 45.2], [-5.4, 45.2], [-5.4, 45.3], [-5.5, 45.3], [-5.5, 45.2]]],
    };

    const result = validateGeometryCoordinates(geometry);
    expect(result.valid).toBe(true);
    expect(result.outOfBounds).toHaveLength(0);
  });

  it('should detect out of bounds coordinates', () => {
    const geometry = {
      type: 'Polygon' as const,
      coordinates: [[[200, 0], [201, 0], [201, 1], [200, 1], [200, 0]]],
    };

    const result = validateGeometryCoordinates(geometry);
    expect(result.valid).toBe(false);
    expect(result.outOfBounds.length).toBeGreaterThan(0);
  });

  it('should work with MultiPolygon', () => {
    const geometry = {
      type: 'MultiPolygon' as const,
      coordinates: [[[[-5.5, 45.2], [-5.4, 45.2], [-5.4, 45.3], [-5.5, 45.3], [-5.5, 45.2]]]],
    };

    const result = validateGeometryCoordinates(geometry);
    expect(result.valid).toBe(true);
  });
});

describe('detectProjectedCoordinates', () => {
  it('should detect projected coordinates (UTM-like)', () => {
    const geometry = {
      type: 'Polygon' as const,
      coordinates: [[[500000, 5000000], [500100, 5000000], [500100, 5000100], [500000, 5000100], [500000, 5000000]]],
    };

    const result = detectProjectedCoordinates(geometry);
    expect(result.likely).toBe(true);
    expect(result.sampleCoord).toBeDefined();
  });

  it('should not flag WGS84 coordinates as projected', () => {
    const geometry = {
      type: 'Polygon' as const,
      coordinates: [[[-5.5, 45.2], [-5.4, 45.2], [-5.4, 45.3], [-5.5, 45.3], [-5.5, 45.2]]],
    };

    const result = detectProjectedCoordinates(geometry);
    expect(result.likely).toBe(false);
  });

  it('should work with MultiPolygon', () => {
    const geometry = {
      type: 'MultiPolygon' as const,
      coordinates: [[[[500000, 5000000], [500100, 5000000], [500100, 5000100], [500000, 5000100], [500000, 5000000]]]],
    };

    const result = detectProjectedCoordinates(geometry);
    expect(result.likely).toBe(true);
  });
});

describe('conformityStatusSchema', () => {
  it('should accept valid conformity statuses', () => {
    expect(conformityStatusSchema.safeParse('conforme').success).toBe(true);
    expect(conformityStatusSchema.safeParse('non_conforme').success).toBe(true);
    expect(conformityStatusSchema.safeParse('en_cours').success).toBe(true);
    expect(conformityStatusSchema.safeParse('informations_manquantes').success).toBe(true);
  });

  it('should reject invalid conformity status', () => {
    expect(conformityStatusSchema.safeParse('invalid').success).toBe(false);
    expect(conformityStatusSchema.safeParse('').success).toBe(false);
  });
});

describe('certificationSchema', () => {
  it('should accept valid certifications', () => {
    expect(certificationSchema.safeParse('rainforest_alliance').success).toBe(true);
    expect(certificationSchema.safeParse('utz').success).toBe(true);
    expect(certificationSchema.safeParse('fairtrade').success).toBe(true);
    expect(certificationSchema.safeParse('bio').success).toBe(true);
    expect(certificationSchema.safeParse('organic').success).toBe(true);
    expect(certificationSchema.safeParse('other').success).toBe(true);
  });

  it('should reject invalid certification', () => {
    expect(certificationSchema.safeParse('invalid').success).toBe(false);
    expect(certificationSchema.safeParse('').success).toBe(false);
  });
});

describe('geometrySchema', () => {
  it('should accept Polygon', () => {
    const polygon = {
      type: 'Polygon' as const,
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
    };
    expect(geometrySchema.safeParse(polygon).success).toBe(true);
  });

  it('should accept MultiPolygon', () => {
    const multiPolygon = {
      type: 'MultiPolygon' as const,
      coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]],
    };
    expect(geometrySchema.safeParse(multiPolygon).success).toBe(true);
  });

  it('should reject Point', () => {
    const point = {
      type: 'Point' as const,
      coordinates: [0, 0],
    };
    expect(geometrySchema.safeParse(point).success).toBe(false);
  });

  it('should reject LineString', () => {
    const lineString = {
      type: 'LineString' as const,
      coordinates: [[0, 0], [1, 1]],
    };
    expect(geometrySchema.safeParse(lineString).success).toBe(false);
  });
});
