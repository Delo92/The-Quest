import { BetaAnalyticsDataClient } from '@google-analytics/data';

let _client: BetaAnalyticsDataClient | null = null;
type PageVisitorsReport = {
  websiteVisitors: number;
  byPath: Record<string, number>;
};
const pageVisitorsCache = new Map<string, { expiresAt: number; report: PageVisitorsReport }>();
const pageVisitorsInFlight = new Map<string, Promise<PageVisitorsReport>>();

function getClient(): BetaAnalyticsDataClient {
  if (_client) return _client;
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  _client = new BetaAnalyticsDataClient({
    credentials: {
      client_email: sa.client_email,
      private_key: sa.private_key,
    },
    projectId: sa.project_id,
  });
  return _client;
}

function getPropertyId(): string {
  const id = process.env.GA4_PROPERTY_ID;
  if (!id) throw new Error('GA4_PROPERTY_ID environment variable not set');
  return id;
}

export async function getPageVisitorsForPaths(paths: string[]): Promise<PageVisitorsReport> {
  const uniquePaths = [...new Set(paths.map((path) => path.trim()).filter((path) => path.startsWith('/')))].sort();
  if (uniquePaths.length === 0) return { websiteVisitors: 0, byPath: {} };

  const cacheKey = uniquePaths.join('\n');
  const cached = pageVisitorsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.report;
  const existingRequest = pageVisitorsInFlight.get(cacheKey);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const client = getClient();
    const propertyId = getPropertyId();
    const pathPattern = `^(?:${uniquePaths.map((path) => path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`;
    const dimensionFilter = {
      filter: {
        fieldName: 'pagePath',
        stringFilter: {
          matchType: 'FULL_REGEXP' as const,
          value: pathPattern,
          caseSensitive: true,
        },
      },
    };
    const baseRequest = {
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensionFilter,
    };

    const [[summaryResponse], [pathResponse]] = await Promise.all([
      client.runReport({
        ...baseRequest,
        metrics: [{ name: 'activeUsers' }],
      }),
      client.runReport({
        ...baseRequest,
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'activeUsers' }],
        limit: 10000,
      }),
    ]);

    const byPath: Record<string, number> = {};
    for (const row of pathResponse.rows || []) {
      const path = row.dimensionValues?.[0]?.value;
      if (path) byPath[path] = Math.max(0, Number(row.metricValues?.[0]?.value) || 0);
    }

    const report = {
      websiteVisitors: Math.max(0, Number(summaryResponse.rows?.[0]?.metricValues?.[0]?.value) || 0),
      byPath,
    };
    pageVisitorsCache.set(cacheKey, { report, expiresAt: Date.now() + 5 * 60 * 1000 });
    return report;
  })();

  pageVisitorsInFlight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    pageVisitorsInFlight.delete(cacheKey);
  }
}

export async function getGA4Report(dateRange: string = '30d') {
  const client = getClient();
  const propertyId = getPropertyId();

  const startDate =
    dateRange === '1d' ? 'yesterday' :
    dateRange === '3d' ? '3daysAgo' :
    dateRange === '7d' ? '7daysAgo' :
    dateRange === '90d' ? '90daysAgo' :
    dateRange === '1y' ? '365daysAgo' : '30daysAgo';

  const [overviewResponse] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate: 'today' }],
    metrics: [
      { name: 'activeUsers' }, { name: 'sessions' },
      { name: 'screenPageViews' }, { name: 'averageSessionDuration' },
      { name: 'bounceRate' }, { name: 'newUsers' },
    ],
  });

  const row = overviewResponse.rows?.[0];
  const overview = {
    activeUsers: parseInt(row?.metricValues?.[0]?.value || '0'),
    sessions: parseInt(row?.metricValues?.[1]?.value || '0'),
    pageViews: parseInt(row?.metricValues?.[2]?.value || '0'),
    avgSessionDuration: parseFloat(row?.metricValues?.[3]?.value || '0'),
    bounceRate: parseFloat(row?.metricValues?.[4]?.value || '0'),
    newUsers: parseInt(row?.metricValues?.[5]?.value || '0'),
  };

  const [pageResponse] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate: 'today' }],
    dimensions: [{ name: 'pagePath' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 10,
  });

  const topPages = (pageResponse.rows || []).map(r => ({
    path: r.dimensionValues?.[0]?.value || '',
    views: parseInt(r.metricValues?.[0]?.value || '0'),
    users: parseInt(r.metricValues?.[1]?.value || '0'),
  }));

  const [dailyResponse] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }],
    orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
  });

  const dailyData = (dailyResponse.rows || []).map(r => {
    const raw = r.dimensionValues?.[0]?.value || '';
    const date = raw.length === 8
      ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
      : raw;
    return {
      date,
      users: parseInt(r.metricValues?.[0]?.value || '0'),
      sessions: parseInt(r.metricValues?.[1]?.value || '0'),
      pageViews: parseInt(r.metricValues?.[2]?.value || '0'),
    };
  });

  const [sourceResponse] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate: 'today' }],
    dimensions: [{ name: 'sessionSource' }],
    metrics: [{ name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 10,
  });

  const trafficSources = (sourceResponse.rows || []).map(r => ({
    source: r.dimensionValues?.[0]?.value || '(direct)',
    sessions: parseInt(r.metricValues?.[0]?.value || '0'),
  }));

  return { overview, topPages, dailyData, trafficSources };
}
