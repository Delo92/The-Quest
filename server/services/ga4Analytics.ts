import { BetaAnalyticsDataClient } from '@google-analytics/data';

let _client: BetaAnalyticsDataClient | null = null;

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
