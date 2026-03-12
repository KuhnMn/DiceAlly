const ALLOWED_ORIGINS = [
  'https://allysheetviewer.pages.mxkuhn.de',
  'https://kuhnmn.github.io',
  'https://mxkuhn.de',
  'https://pages.mxkuhn.de',
];

function getAllowedOrigin(origin) {
  if (!origin) return null;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowedOrigin = getAllowedOrigin(origin);

    // Reject browser requests from disallowed origins
    if (origin && !allowedOrigin) {
      return new Response('Forbidden', { status: 403 });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: allowedOrigin ? corsHeaders(allowedOrigin) : {},
      });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${env.AUTH_TOKEN}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    const requestUrl = new URL(request.url);
    const upstreamParam = requestUrl.searchParams.get('url');

    if (!upstreamParam) {
      return new Response('Missing url query parameter', { status: 400 });
    }

    let upstreamUrl;
    try {
      upstreamUrl = new URL(upstreamParam);
    } catch {
      return new Response('Invalid url query parameter', { status: 400 });
    }

    if (upstreamUrl.hostname !== 'tmpfiles.org') {
      return new Response('Host not allowed', { status: 403 });
    }

    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'AllySheetViewerProxy/1.0',
      },
    });

    const headers = new Headers(upstreamResponse.headers);
    if (allowedOrigin) {
      Object.entries(corsHeaders(allowedOrigin)).forEach(([k, v]) => headers.set(k, v));
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
  },
};