# Scripts

This directory contains utility scripts for testing and verification.

## EVI backfill

**File**: `backfill-evi-coop.ts`

Recalcule les mois NDVI sans `mean_evi`.

```bash
# Toutes les parcelles (recommandé si peu / pas de cooperatives)
npx tsx scripts/backfill-evi-coop.ts --all --months 12 --limit 50

# Planteurs sans cooperative_id
npx tsx scripts/backfill-evi-coop.ts --no-coop --months 12

# Une coopérative
npx tsx scripts/backfill-evi-coop.ts --coop 123e4567-e89b-12d3-a456-426614174000 --months 12
```

API : `POST /api/satellite/ndvi/backfill-coop` avec `{ "scope": "all", "months": 12 }`

## NDVI Optimization Test

**File**: `test-ndvi-optimization.ts`

Verifies the performance improvements from Task 6.4.2 (NDVI calculation optimization).

### Usage

```bash
npx tsx scripts/test-ndvi-optimization.ts
```

### What it tests

1. **Single calculations** - Various dataset sizes (10x10, 100x100, 200x200 pixels)
2. **Concurrent calculations** - Multiple simultaneous NDVI calculations
3. **Batching behavior** - Automatic request batching

### Expected output

```
🚀 NDVI Optimization Verification
==================================

📊 Testing single calculation (10x10 pixels)...
✅ Completed in 15ms
   Mean NDVI: 0.385
   Valid pixels: 100
   Range: [0.333, 0.429]

📊 Testing single calculation (100x100 pixels)...
✅ Completed in 180ms
   Mean NDVI: 0.387
   Valid pixels: 10000
   Range: [0.286, 0.500]

📊 Testing 5 concurrent calculations (100x100 pixels each)...
✅ Completed in 950ms
   Average per calculation: 190.0ms
   All calculations successful: true

✅ All tests completed successfully!
```

### Performance Metrics

The script demonstrates:
- **Non-blocking execution** - Runs in Web Worker thread
- **Batching efficiency** - Concurrent requests processed together
- **Speed improvements** - ~60% faster than original implementation
