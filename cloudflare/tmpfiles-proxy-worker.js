export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
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
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
  },
};