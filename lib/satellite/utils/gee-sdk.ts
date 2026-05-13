/**
 * Google Earth Engine SDK Helper
 * 
 * Initializes and provides access to the @google/earthengine SDK.
 * Uses authenticateViaPrivateKey + initialize pattern which works
 * correctly with the GEE REST API v1.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ee = require('@google/earthengine');

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the Earth Engine SDK with service account credentials.
 * Safe to call multiple times — only initializes once.
 */
export async function initializeEE(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = new Promise<void>((resolve, reject) => {
    const serviceAccount = process.env.GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT;
    const privateKey = process.env.GOOGLE_EARTH_ENGINE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!serviceAccount || !privateKey) {
      reject(new Error('Missing GOOGLE_EARTH_ENGINE_SERVICE_ACCOUNT or GOOGLE_EARTH_ENGINE_PRIVATE_KEY'));
      return;
    }

    const credentials = { client_email: serviceAccount, private_key: privateKey };

    ee.data.authenticateViaPrivateKey(
      credentials,
      () => {
        ee.initialize(
          null,
          null,
          () => {
            initialized = true;
            console.log('[GEE SDK] Earth Engine initialized successfully');
            resolve();
          },
          (err: unknown) => {
            initPromise = null;
            reject(new Error(`GEE initialization failed: ${err}`));
          }
        );
      },
      (err: unknown) => {
        initPromise = null;
        reject(new Error(`GEE authentication failed: ${err}`));
      }
    );
  });

  return initPromise;
}

/**
 * Get the initialized Earth Engine instance.
 * Automatically initializes if not already done.
 */
export async function getEE(): Promise<typeof ee> {
  await initializeEE();
  return ee;
}

/**
 * Evaluate an Earth Engine computation and return the result.
 * Wraps the callback-based evaluate() in a Promise.
 */
export function evaluateEE<T>(eeObject: unknown): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    (eeObject as { evaluate: (cb: (val: T, err?: string) => void) => void }).evaluate(
      (val: T, err?: string) => {
        if (err) {
          reject(new Error(`GEE evaluation error: ${err}`));
        } else {
          resolve(val);
        }
      }
    );
  });
}
