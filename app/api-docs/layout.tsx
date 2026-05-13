import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'API Documentation | CocoaTrack',
  description:
    'Interactive API documentation for the CocoaTrack Satellite Imagery API. Explore endpoints for NDVI analysis, deforestation detection, temporal analysis, and more.',
  robots: 'noindex, nofollow', // Don't index API docs
};

export default function ApiDocsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
