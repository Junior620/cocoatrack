/**
 * GET /api/satellite/test-gee-api
 * Tests the actual GEE API call with a simple computeValue request.
 * DEVELOPMENT ONLY.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  const results: Record<string, unknown> = {};
  const projectId = process.env.GOOGLE_EARTH_ENGINE_PROJECT_ID;

  try {
    const { getAccessToken } = await import('@/lib/satellite/utils/gee-auth');
    const token = await getAccessToken();
    results.tokenOk = true;

    // Test 1: Simple computeValue with a constant
    const url1 = `https://earthengine.googleapis.com/v1/projects/${projectId}:computeValue`;
    results.url = url1;

    const body = {
      expression: {
        result: '0',
        values: {
          '0': { constantValue: 42 }
        }
      }
    };

    // Use https module with IPv4 to avoid timeout
    const https = require('https');
    const { URL } = require('url');
    const parsed = new URL(url1);
    const bodyStr = JSON.stringify(body);

    const response = await new Promise<{ status: number; data: string }>((resolve, reject) => {
      const req = https.request({
        hostname: parsed.hostname,
        path: parsed.pathname,
        method: 'POST',
        family: 4,
        timeout: 15000,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      }, (res: any) => {
        let data = '';
        res.on('data', (c: string) => { data += c; });
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });

    results.httpStatus = response.status;
    results.responsePreview = response.data.substring(0, 500);

    if (response.status === 200) {
      results.apiWorking = true;
    } else if (response.status === 404) {
      results.apiWorking = false;
      results.hint = 'Project not found in GEE. Try using "projects/earthengine-public" or check project registration at https://code.earthengine.google.com/';
      
      // Try with alternative project format
      const url2 = `https://earthengine.googleapis.com/v1alpha/projects/${projectId}:computeValue`;
      results.tryingAlternativeUrl = url2;
      
      const parsed2 = new URL(url2);
      const response2 = await new Promise<{ status: number; data: string }>((resolve, reject) => {
        const req = https.request({
          hostname: parsed2.hostname,
          path: parsed2.pathname,
          method: 'POST',
          family: 4,
          timeout: 15000,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyStr),
          },
        }, (res: any) => {
          let data = '';
          res.on('data', (c: string) => { data += c; });
          res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.on('error', reject);
        req.write(bodyStr);
        req.end();
      });
      results.alternativeStatus = response2.status;
      results.alternativePreview = response2.data.substring(0, 300);
    }

  } catch (err) {
    results.error = (err as Error).message;
  }

  return NextResponse.json(results);
}
