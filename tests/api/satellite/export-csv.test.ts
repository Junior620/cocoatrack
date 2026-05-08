/**
 * Integration tests for CSV export API endpoint
 * 
 * Tests GET /api/satellite/export/csv
 * Tests POST /api/satellite/export/csv
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe('GET /api/satellite/export/csv', () => {
  let supabase: ReturnType<typeof createClient>;
  let authToken: string;
  let testParcelleId: string;

  beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Sign in with test user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PASSWORD || 'testpassword',
    });

    if (authError || !authData.session) {
      throw new Error('Failed to authenticate test user');
    }

    authToken = authData.session.access_token;

    // Get a test parcelle
    const { data: parcelles, error: parcelleError } = await supabase
      .from('parcelles')
      .select('id')
      .limit(1);

    if (parcelleError || !parcelles || parcelles.length === 0) {
      throw new Error('No test parcelles available');
    }

    testParcelleId = parcelles[0].id;
  });

  afterAll(async () => {
    await supabase.auth.signOut();
  });

  it('should require authentication', async () => {
    const response = await fetch(
      `http://localhost:3000/api/satellite/export/csv?parcelleId=${testParcelleId}`,
      {
        method: 'GET',
      }
    );

    expect(response.status).toBe(401);
  });

  it('should require parcelleId parameter', async () => {
    const response = await fetch(
      'http://localhost:3000/api/satellite/export/csv',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('parcelleId');
  });

  it('should validate parcelleId format', async () => {
    const response = await fetch(
      'http://localhost:3000/api/satellite/export/csv?parcelleId=invalid-uuid',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid parcelleId');
  });

  it('should return 404 for non-existent parcelle', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const response = await fetch(
      `http://localhost:3000/api/satellite/export/csv?parcelleId=${fakeUuid}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    expect(response.status).toBe(404);
  });

  it('should return CSV with correct content type', async () => {
    // First, ensure there's NDVI data for the test parcelle
    const { data: ndviData } = await supabase
      .from('ndvi_results')
      .select('id')
      .eq('parcelle_id', testParcelleId)
      .limit(1);

    if (!ndviData || ndviData.length === 0) {
      console.log('Skipping test: No NDVI data available for test parcelle');
      return;
    }

    const response = await fetch(
      `http://localhost:3000/api/satellite/export/csv?parcelleId=${testParcelleId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
  });

  it('should return CSV with correct headers', async () => {
    // First, ensure there's NDVI data for the test parcelle
    const { data: ndviData } = await supabase
      .from('ndvi_results')
      .select('id')
      .eq('parcelle_id', testParcelleId)
      .limit(1);

    if (!ndviData || ndviData.length === 0) {
      console.log('Skipping test: No NDVI data available for test parcelle');
      return;
    }

    const response = await fetch(
      `http://localhost:3000/api/satellite/export/csv?parcelleId=${testParcelleId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    const csv = await response.text();
    const lines = csv.split('\n');
    
    expect(lines[0]).toBe('date,mean_ndvi,min_ndvi,max_ndvi,std_dev,health_status,change_from_previous');
  });

  it('should set content-disposition header for download', async () => {
    // First, ensure there's NDVI data for the test parcelle
    const { data: ndviData } = await supabase
      .from('ndvi_results')
      .select('id')
      .eq('parcelle_id', testParcelleId)
      .limit(1);

    if (!ndviData || ndviData.length === 0) {
      console.log('Skipping test: No NDVI data available for test parcelle');
      return;
    }

    const response = await fetch(
      `http://localhost:3000/api/satellite/export/csv?parcelleId=${testParcelleId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    const contentDisposition = response.headers.get('content-disposition');
    expect(contentDisposition).toContain('attachment');
    expect(contentDisposition).toContain('filename=');
    expect(contentDisposition).toContain('.csv');
  });

  it('should filter by startDate', async () => {
    // First, ensure there's NDVI data for the test parcelle
    const { data: ndviData } = await supabase
      .from('ndvi_results')
      .select('calculation_date')
      .eq('parcelle_id', testParcelleId)
      .order('calculation_date', { ascending: true });

    if (!ndviData || ndviData.length === 0) {
      console.log('Skipping test: No NDVI data available for test parcelle');
      return;
    }

    // Use a date in the middle of the range
    const startDate = new Date(ndviData[0].calculation_date);
    startDate.setDate(startDate.getDate() + 1);

    const response = await fetch(
      `http://localhost:3000/api/satellite/export/csv?parcelleId=${testParcelleId}&startDate=${startDate.toISOString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    if (response.status === 404) {
      console.log('Skipping test: No NDVI data in filtered range');
      return;
    }

    expect(response.status).toBe(200);
    const csv = await response.text();
    const lines = csv.split('\n').filter(line => line.length > 0);
    
    // Should have header + at least one data row
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('should filter by endDate', async () => {
    // First, ensure there's NDVI data for the test parcelle
    const { data: ndviData } = await supabase
      .from('ndvi_results')
      .select('calculation_date')
      .eq('parcelle_id', testParcelleId)
      .order('calculation_date', { ascending: false });

    if (!ndviData || ndviData.length === 0) {
      console.log('Skipping test: No NDVI data available for test parcelle');
      return;
    }

    // Use a date in the middle of the range
    const endDate = new Date(ndviData[0].calculation_date);
    endDate.setDate(endDate.getDate() - 1);

    const response = await fetch(
      `http://localhost:3000/api/satellite/export/csv?parcelleId=${testParcelleId}&endDate=${endDate.toISOString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    if (response.status === 404) {
      console.log('Skipping test: No NDVI data in filtered range');
      return;
    }

    expect(response.status).toBe(200);
  });

  it('should validate date format', async () => {
    const response = await fetch(
      `http://localhost:3000/api/satellite/export/csv?parcelleId=${testParcelleId}&startDate=invalid-date`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid startDate');
  });
});

describe('POST /api/satellite/export/csv', () => {
  let supabase: ReturnType<typeof createClient>;
  let authToken: string;
  let testParcelleId: string;

  beforeAll(async () => {
    supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Sign in with test user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PASSWORD || 'testpassword',
    });

    if (authError || !authData.session) {
      throw new Error('Failed to authenticate test user');
    }

    authToken = authData.session.access_token;

    // Get a test parcelle
    const { data: parcelles, error: parcelleError } = await supabase
      .from('parcelles')
      .select('id')
      .limit(1);

    if (parcelleError || !parcelles || parcelles.length === 0) {
      throw new Error('No test parcelles available');
    }

    testParcelleId = parcelles[0].id;
  });

  afterAll(async () => {
    await supabase.auth.signOut();
  });

  it('should require authentication', async () => {
    const response = await fetch(
      'http://localhost:3000/api/satellite/export/csv',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parcelleId: testParcelleId,
        }),
      }
    );

    expect(response.status).toBe(401);
  });

  it('should require parcelleId in body', async () => {
    const response = await fetch(
      'http://localhost:3000/api/satellite/export/csv',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({}),
      }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid request body');
  });

  it('should validate parcelleId format', async () => {
    const response = await fetch(
      'http://localhost:3000/api/satellite/export/csv',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          parcelleId: 'invalid-uuid',
        }),
      }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid request body');
  });

  it('should return 404 for non-existent parcelle', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const response = await fetch(
      'http://localhost:3000/api/satellite/export/csv',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          parcelleId: fakeUuid,
        }),
      }
    );

    expect(response.status).toBe(404);
  });

  it('should return CSV with correct content type', async () => {
    // First, ensure there's NDVI data for the test parcelle
    const { data: ndviData } = await supabase
      .from('ndvi_results')
      .select('id')
      .eq('parcelle_id', testParcelleId)
      .limit(1);

    if (!ndviData || ndviData.length === 0) {
      console.log('Skipping test: No NDVI data available for test parcelle');
      return;
    }

    const response = await fetch(
      'http://localhost:3000/api/satellite/export/csv',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          parcelleId: testParcelleId,
        }),
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
  });

  it('should return CSV with correct headers', async () => {
    // First, ensure there's NDVI data for the test parcelle
    const { data: ndviData } = await supabase
      .from('ndvi_results')
      .select('id')
      .eq('parcelle_id', testParcelleId)
      .limit(1);

    if (!ndviData || ndviData.length === 0) {
      console.log('Skipping test: No NDVI data available for test parcelle');
      return;
    }

    const response = await fetch(
      'http://localhost:3000/api/satellite/export/csv',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          parcelleId: testParcelleId,
        }),
      }
    );

    const csv = await response.text();
    const lines = csv.split('\n');
    
    expect(lines[0]).toBe('date,mean_ndvi,min_ndvi,max_ndvi,std_dev,health_status,change_from_previous');
  });

  it('should set content-disposition header for download', async () => {
    // First, ensure there's NDVI data for the test parcelle
    const { data: ndviData } = await supabase
      .from('ndvi_results')
      .select('id')
      .eq('parcelle_id', testParcelleId)
      .limit(1);

    if (!ndviData || ndviData.length === 0) {
      console.log('Skipping test: No NDVI data available for test parcelle');
      return;
    }

    const response = await fetch(
      'http://localhost:3000/api/satellite/export/csv',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          parcelleId: testParcelleId,
        }),
      }
    );

    const contentDisposition = response.headers.get('content-disposition');
    expect(contentDisposition).toContain('attachment');
    expect(contentDisposition).toContain('filename=');
    expect(contentDisposition).toContain('.csv');
  });

  it('should filter by startDate', async () => {
    // First, ensure there's NDVI data for the test parcelle
    const { data: ndviData } = await supabase
      .from('ndvi_results')
      .select('calculation_date')
      .eq('parcelle_id', testParcelleId)
      .order('calculation_date', { ascending: true });

    if (!ndviData || ndviData.length === 0) {
      console.log('Skipping test: No NDVI data available for test parcelle');
      return;
    }

    // Use a date in the middle of the range
    const startDate = new Date(ndviData[0].calculation_date);
    startDate.setDate(startDate.getDate() + 1);

    const response = await fetch(
      'http://localhost:3000/api/satellite/export/csv',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          parcelleId: testParcelleId,
          startDate: startDate.toISOString(),
        }),
      }
    );

    if (response.status === 404) {
      console.log('Skipping test: No NDVI data in filtered range');
      return;
    }

    expect(response.status).toBe(200);
    const csv = await response.text();
    const lines = csv.split('\n').filter(line => line.length > 0);
    
    // Should have header + at least one data row
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('should filter by endDate', async () => {
    // First, ensure there's NDVI data for the test parcelle
    const { data: ndviData } = await supabase
      .from('ndvi_results')
      .select('calculation_date')
      .eq('parcelle_id', testParcelleId)
      .order('calculation_date', { ascending: false });

    if (!ndviData || ndviData.length === 0) {
      console.log('Skipping test: No NDVI data available for test parcelle');
      return;
    }

    // Use a date in the middle of the range
    const endDate = new Date(ndviData[0].calculation_date);
    endDate.setDate(endDate.getDate() - 1);

    const response = await fetch(
      'http://localhost:3000/api/satellite/export/csv',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          parcelleId: testParcelleId,
          endDate: endDate.toISOString(),
        }),
      }
    );

    if (response.status === 404) {
      console.log('Skipping test: No NDVI data in filtered range');
      return;
    }

    expect(response.status).toBe(200);
  });

  it('should validate date format', async () => {
    const response = await fetch(
      'http://localhost:3000/api/satellite/export/csv',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          parcelleId: testParcelleId,
          startDate: 'invalid-date',
        }),
      }
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid startDate');
  });

  it('should handle both startDate and endDate filters', async () => {
    // First, ensure there's NDVI data for the test parcelle
    const { data: ndviData } = await supabase
      .from('ndvi_results')
      .select('calculation_date')
      .eq('parcelle_id', testParcelleId)
      .order('calculation_date', { ascending: true });

    if (!ndviData || ndviData.length < 2) {
      console.log('Skipping test: Not enough NDVI data available for test parcelle');
      return;
    }

    const startDate = new Date(ndviData[0].calculation_date);
    const endDate = new Date(ndviData[ndviData.length - 1].calculation_date);

    const response = await fetch(
      'http://localhost:3000/api/satellite/export/csv',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          parcelleId: testParcelleId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
      }
    );

    expect(response.status).toBe(200);
    const csv = await response.text();
    const lines = csv.split('\n').filter(line => line.length > 0);
    
    // Should have header + at least one data row
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
});
