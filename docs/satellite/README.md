# Satellite Imagery Analysis Documentation

This directory contains documentation for the satellite imagery analysis feature in CocoaTrack.

## Documentation Index

### Setup and Configuration

- **[Storage Buckets](./storage-buckets.md)** - Supabase Storage bucket configuration and usage
- **[GEE Setup](./gee-setup.md)** *(To be created)* - Google Earth Engine account and API setup
- **[Environment Configuration](./environment-setup.md)** *(To be created)* - Environment variables and credentials

### Features and Usage

- **[NDVI Calculation](./ndvi-calculation.md)** *(To be created)* - NDVI calculation methodology and interpretation
- **[Temporal Analysis](./temporal-analysis.md)** *(To be created)* - Time-series analysis and change detection
- **[Deforestation Detection](./deforestation-detection.md)** *(To be created)* - EUDR compliance and deforestation monitoring

### Technical Reference

- **[API Documentation](../api/satellite.md)** *(To be created)* - REST API endpoints and usage
- **[Database Schema](../database/satellite-schema.md)** *(To be created)* - Database tables and relationships
- **[Architecture](./architecture.md)** *(To be created)* - System architecture and data flow

## Quick Start

1. **Set up Google Earth Engine**: Follow [GEE Setup](./gee-setup.md) to create an account and service credentials
2. **Configure Storage**: Storage buckets are automatically created via migration
3. **Set Environment Variables**: Add GEE credentials to `.env.local`
4. **Run Migrations**: Apply database migrations with `supabase db push`
5. **Test Integration**: Use the API endpoints to retrieve satellite imagery

## Key Concepts

### Satellite Imagery
- **Source**: Sentinel-2 satellite (ESA)
- **Resolution**: 10-20 meters
- **Revisit Frequency**: 5 days
- **Access**: Via Google Earth Engine API

### NDVI (Normalized Difference Vegetation Index)
- **Range**: -1 to +1
- **Formula**: (NIR - Red) / (NIR + Red)
- **Interpretation**: Higher values indicate healthier vegetation

### Health Status Classification
- **Excellent**: NDVI 0.7-1.0 (Dark Green)
- **Good**: NDVI 0.6-0.7 (Green)
- **Fair**: NDVI 0.5-0.6 (Yellow)
- **Poor**: NDVI 0.3-0.5 (Orange)
- **Critical**: NDVI 0.0-0.3 (Red)

### EUDR Compliance
- **Baseline Date**: December 31, 2020
- **Threshold**: NDVI decrease > 0.3 over area > 0.5 hectares
- **Requirement**: Proof of no deforestation after baseline date

## Storage Buckets

| Bucket | Purpose | Retention | Size Limit |
|--------|---------|-----------|------------|
| `satellite-imagery` | Raw satellite imagery | 90 days | 50MB |
| `ndvi-rasters` | NDVI visualization | 30 days | 20MB |
| `kml-exports` | User KML exports | 7 days | 10MB |
| `certification-reports` | EUDR reports | 1 year | 100MB |

See [Storage Buckets](./storage-buckets.md) for detailed configuration.

## API Endpoints

- `GET /api/satellite/imagery` - Retrieve satellite imagery
- `POST /api/satellite/ndvi` - Calculate NDVI
- `GET /api/satellite/temporal` - Get temporal analysis
- `GET /api/satellite/deforestation` - Check deforestation alerts
- `POST /api/satellite/export/kml` - Export KML file

See [API Documentation](../api/satellite.md) for complete reference.

## Development Workflow

1. **Phase 1**: Foundation (Imagery retrieval, database, basic map integration)
2. **Phase 2**: NDVI Calculation (Health status, visualization)
3. **Phase 3**: Temporal Analysis (Time-series, change detection)
4. **Phase 4**: Deforestation Detection (EUDR compliance, alerts)
5. **Phase 5**: Advanced Features (Yield prediction, batch processing)

## Support and Troubleshooting

For common issues and solutions, see the troubleshooting sections in:
- [Storage Buckets Troubleshooting](./storage-buckets.md#troubleshooting)
- [GEE Setup Troubleshooting](./gee-setup.md#troubleshooting) *(To be created)*

## Related Resources

- [Google Earth Engine Documentation](https://developers.google.com/earth-engine)
- [Sentinel-2 User Guide](https://sentinel.esa.int/web/sentinel/user-guides/sentinel-2-msi)
- [NDVI Explained](https://en.wikipedia.org/wiki/Normalized_difference_vegetation_index)
- [EU Deforestation Regulation](https://environment.ec.europa.eu/topics/forests/deforestation_en)
