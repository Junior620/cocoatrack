# Request Queue Usage Guide

This guide explains how to use the request queue feature for offline support in the satellite imagery analysis system.

## Overview

The request queue automatically queues failed API requests when offline and retries them when the browser comes back online. Requests are persisted in IndexedDB to survive page reloads.

## Features

- **Automatic Queuing**: Failed requests are automatically queued when offline
- **Automatic Retry**: Queued requests are automatically retried when back online
- **Persistence**: Queue survives page reloads using IndexedDB
- **Exponential Backoff**: Failed retries use exponential backoff
- **UI Indicators**: Show pending request count and status
- **Manual Control**: Manually trigger retries or clear the queue

## Basic Usage

### 1. Using the Queued Fetch Wrapper

The simplest way to add offline support to your API calls is to use the `queuedFetch` wrapper:

```typescript
import { queuedPost } from '@/lib/satellite/utils/request-queue-integration';

// Make an API call with automatic queuing
const result = await queuedPost<NDVIResult>('/api/satellite/ndvi', {
  parcelleId: '123',
  date: new Date()
}, {
  queueMetadata: {
    parcelleId: '123',
    operation: 'ndvi-calculation',
    description: 'Calculate NDVI for parcelle 123'
  }
});

// Check if request was queued
if (result.queued) {
  console.log('Request queued for later retry');
  // Show user feedback
} else if (result.data) {
  console.log('Request succeeded:', result.data);
  // Use the data
} else if (result.error) {
  console.error('Request failed:', result.error);
  // Handle error
}
```

### 2. Using the Request Queue Service Directly

For more control, you can use the request queue service directly:

```typescript
import { getRequestQueue } from '@/lib/satellite/services/request-queue.service';

// Get the queue instance
const queue = await getRequestQueue();

// Manually enqueue a request
const queueId = await queue.enqueue({
  url: '/api/satellite/imagery',
  method: 'GET',
  headers: { 'Content-Type': 'application/json' },
  metadata: {
    parcelleId: '123',
    operation: 'imagery-fetch'
  }
});

// Get queue statistics
const stats = await queue.getStatistics();
console.log(`${stats.pendingRequests} requests pending`);

// Manually trigger retry
await queue.retryAll();

// Listen for queue events
queue.on('request-completed', (event) => {
  console.log('Request completed:', event.request);
});
```

### 3. Using the React Hook

In React components, use the `useRequestQueue` hook:

```typescript
import { useRequestQueue } from '@/hooks/satellite/useRequestQueue';

function MyComponent() {
  const { state, operations, pendingCount } = useRequestQueue();

  return (
    <div>
      <p>Pending requests: {pendingCount}</p>
      
      {state.isRetrying && <p>Retrying queued requests...</p>}
      
      {state.error && (
        <div className="error">
          Error: {state.error.message}
        </div>
      )}
      
      <button onClick={operations.retryAll}>
        Retry All
      </button>
      
      <button onClick={operations.clear}>
        Clear Queue
      </button>
    </div>
  );
}
```

### 4. Using the UI Component

Add the request queue indicator to your layout:

```typescript
import { RequestQueueIndicator } from '@/components/satellite/RequestQueueIndicator';

function Layout() {
  return (
    <div>
      {/* Your content */}
      
      {/* Request queue indicator (bottom-right corner) */}
      <RequestQueueIndicator position="bottom-right" />
    </div>
  );
}
```

Or use the simple badge:

```typescript
import { RequestQueueBadge } from '@/components/satellite/RequestQueueIndicator';

function Header() {
  return (
    <header>
      <h1>Satellite Analysis</h1>
      <RequestQueueBadge />
    </header>
  );
}
```

## Integration Examples

### Example 1: NDVI Calculation with Offline Support

```typescript
import { queuedPost, hasData, unwrapData } from '@/lib/satellite/utils/request-queue-integration';
import type { NDVIResult } from '@/lib/satellite/types';

async function calculateNDVI(parcelleId: string, date: Date): Promise<NDVIResult | null> {
  const result = await queuedPost<NDVIResult>('/api/satellite/ndvi', {
    parcelleId,
    date: date.toISOString()
  }, {
    queueMetadata: {
      parcelleId,
      operation: 'ndvi-calculation',
      description: `Calculate NDVI for parcelle ${parcelleId}`
    }
  });

  if (hasData(result)) {
    return result.data;
  }

  if (result.queued) {
    // Show user feedback
    console.log('NDVI calculation queued - will retry when online');
    return null;
  }

  if (result.error) {
    console.error('NDVI calculation failed:', result.error);
    throw result.error;
  }

  return null;
}
```

### Example 2: Imagery Fetch with Fallback to Cache

```typescript
import { queuedGet, hasData } from '@/lib/satellite/utils/request-queue-integration';
import { getIndexedDBCache } from '@/lib/satellite/cache/indexeddb-cache';
import type { ImageryData } from '@/lib/satellite/types';

async function getImagery(parcelleId: string, date: Date): Promise<ImageryData | null> {
  // Try to fetch from API
  const result = await queuedGet<ImageryData>(
    `/api/satellite/imagery?parcelleId=${parcelleId}&date=${date.toISOString()}`,
    {
      queueMetadata: {
        parcelleId,
        operation: 'imagery-fetch',
        description: `Fetch imagery for parcelle ${parcelleId}`
      }
    }
  );

  if (hasData(result)) {
    return result.data;
  }

  // If queued or failed, try to get from cache
  const cache = await getIndexedDBCache();
  const cachedImagery = await cache.getImagery(parcelleId, date);

  if (cachedImagery) {
    console.log('Using cached imagery');
    return cachedImagery;
  }

  return null;
}
```

### Example 3: React Component with Queue Status

```typescript
import { useState } from 'react';
import { useRequestQueue } from '@/hooks/satellite/useRequestQueue';
import { queuedPost } from '@/lib/satellite/utils/request-queue-integration';

function NDVICalculator({ parcelleId }: { parcelleId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NDVIResult | null>(null);
  const { pendingCount, operations } = useRequestQueue();

  const handleCalculate = async () => {
    setLoading(true);
    
    const response = await queuedPost<NDVIResult>('/api/satellite/ndvi', {
      parcelleId,
      date: new Date().toISOString()
    }, {
      queueMetadata: {
        parcelleId,
        operation: 'ndvi-calculation'
      }
    });

    setLoading(false);

    if (response.data) {
      setResult(response.data);
    } else if (response.queued) {
      alert('Request queued - will retry when online');
    } else if (response.error) {
      alert(`Error: ${response.error.message}`);
    }
  };

  return (
    <div>
      <button onClick={handleCalculate} disabled={loading}>
        {loading ? 'Calculating...' : 'Calculate NDVI'}
      </button>

      {pendingCount > 0 && (
        <div className="queue-status">
          <p>{pendingCount} requests pending</p>
          <button onClick={operations.retryAll}>Retry Now</button>
        </div>
      )}

      {result && (
        <div className="result">
          <p>Mean NDVI: {result.meanNDVI.toFixed(3)}</p>
          <p>Health Status: {result.healthStatus}</p>
        </div>
      )}
    </div>
  );
}
```

## API Reference

### queuedFetch

```typescript
function queuedFetch<T>(
  url: string,
  options?: QueuedFetchOptions
): Promise<QueuedFetchResult<T>>
```

Fetch wrapper that automatically queues failed requests when offline.

**Options:**
- `autoQueue`: Whether to automatically queue on failure (default: true)
- `queueMetadata`: Metadata to attach to queued request
  - `parcelleId`: Parcelle ID
  - `operation`: Operation name
  - `description`: Human-readable description

**Returns:**
- `data`: Response data (null if queued)
- `queued`: Whether the request was queued
- `queueId`: Queue ID if request was queued
- `error`: Error if request failed

### Convenience Wrappers

```typescript
queuedGet<T>(url: string, options?: QueuedFetchOptions)
queuedPost<T>(url: string, data: unknown, options?: QueuedFetchOptions)
queuedPut<T>(url: string, data: unknown, options?: QueuedFetchOptions)
queuedDelete<T>(url: string, options?: QueuedFetchOptions)
```

### Utility Functions

```typescript
isQueued(result): boolean
hasData(result): boolean
hasError(result): boolean
unwrapData(result): T  // Throws if queued or error
```

## Best Practices

1. **Always provide metadata**: Include `parcelleId`, `operation`, and `description` for better debugging and user feedback

2. **Handle all result states**: Check for `queued`, `data`, and `error` states

3. **Provide user feedback**: Show users when requests are queued and when they're being retried

4. **Use cache as fallback**: When a request is queued, try to serve cached data if available

5. **Test offline scenarios**: Test your application with network throttling to ensure offline support works correctly

6. **Monitor queue size**: Keep an eye on the queue size and clear old requests if needed

7. **Use the UI component**: Add the `RequestQueueIndicator` to your layout for automatic queue management

## Troubleshooting

### Requests not being queued

- Check that `autoQueue` is not set to `false`
- Verify that `isOffline()` returns `true` when offline
- Check browser console for errors

### Requests not retrying automatically

- Verify that network status change events are firing
- Check that requests haven't exceeded max retries
- Look for errors in the retry logic

### Queue growing too large

- Implement periodic queue cleanup
- Set appropriate max retry limits
- Clear failed requests after a certain time

### IndexedDB errors

- Check browser support for IndexedDB
- Verify storage quota hasn't been exceeded
- Clear IndexedDB data if corrupted

## Performance Considerations

- **Queue size**: The queue stores requests in IndexedDB, which has storage limits
- **Retry frequency**: Exponential backoff prevents overwhelming the server
- **Event listeners**: Clean up event listeners when components unmount
- **Memory usage**: Large request bodies increase memory usage

## Security Considerations

- **Sensitive data**: Be careful queuing requests with sensitive data
- **Authentication tokens**: Tokens may expire before retry
- **Request validation**: Validate queued requests before retry
- **User permissions**: Verify user still has permission when retrying
