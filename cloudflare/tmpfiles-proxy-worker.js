const ALLOWED_ORIGINS = [
  'https://allysheetviewer.pages.mxkuhn.de',
  'https://kuhnmn.github.io',
  'https://mxkuhn.de',
  'https://pages.mxkuhn.de',
];

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const FILE_TTL_SECONDS = 300;
const MAX_ID_ATTEMPTS = 10;

function getAllowedOrigin(origin) {
  if (!origin) return null;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Vary': 'Origin',
  };
}

function jsonResponse(payload, status, allowedOrigin) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
  });
  if (allowedOrigin) {
    Object.entries(corsHeaders(allowedOrigin)).forEach(([key, value]) => headers.set(key, value));
  }

  return new Response(JSON.stringify(payload), { status, headers });
}

function extractFileId(pathname) {
  const match = pathname.match(/^\/files\/(\d{6}|[a-f0-9]{32})\/?$/i);
  if (!match) return null;
  return match[1].toLowerCase();
}

function generateShortId() {
  const random = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return random.toString().padStart(6, '0');
}

export default {
  async fetch(request, env) {
    if (!env.TEMP_UPLOADS) {
      return new Response('Worker KV binding TEMP_UPLOADS is missing', { status: 500 });
    }

    const origin = request.headers.get('Origin');
    const allowedOrigin = getAllowedOrigin(origin);
    const requestUrl = new URL(request.url);
    const fileId = extractFileId(requestUrl.pathname);

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

    if (request.method === 'POST' && requestUrl.pathname === '/upload') {
      const rawBody = await request.text();
      const size = new TextEncoder().encode(rawBody).byteLength;
      if (size > MAX_UPLOAD_SIZE_BYTES) {
        return jsonResponse({ error: `Payload exceeds 5MB limit (${MAX_UPLOAD_SIZE_BYTES} bytes)` }, 413, allowedOrigin);
      }

      let parsed;
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        return jsonResponse({ error: 'Request body must be valid JSON' }, 400, allowedOrigin);
      }

      if (!parsed || typeof parsed !== 'object' || !parsed.character) {
        return jsonResponse({ error: 'Invalid character payload' }, 400, allowedOrigin);
      }

      let id = null;
      for (let i = 0; i < MAX_ID_ATTEMPTS; i += 1) {
        const candidateId = generateShortId();
        const exists = await env.TEMP_UPLOADS.get(candidateId);
        if (!exists) {
          id = candidateId;
          break;
        }
      }

      if (!id) {
        return jsonResponse({ error: 'Could not allocate short ID, try again' }, 503, allowedOrigin);
      }

      await env.TEMP_UPLOADS.put(id, rawBody, { expirationTtl: FILE_TTL_SECONDS });

      return jsonResponse(
        {
          success: true,
          data: {
            id,
            url: `${requestUrl.origin}/files/${id}`,
            expiresInSeconds: FILE_TTL_SECONDS,
            maxUploadSizeBytes: MAX_UPLOAD_SIZE_BYTES,
          },
        },
        200,
        allowedOrigin,
      );
    }

    if (request.method === 'GET' && fileId) {
      const storedPayload = await env.TEMP_UPLOADS.get(fileId);
      if (!storedPayload) {
        return jsonResponse({ error: 'File not found or expired' }, 404, allowedOrigin);
      }

      const headers = new Headers({
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      if (allowedOrigin) {
        Object.entries(corsHeaders(allowedOrigin)).forEach(([key, value]) => headers.set(key, value));
      }

      return new Response(storedPayload, {
        status: 200,
        headers,
      });
    }

    return jsonResponse(
      {
        error: 'Not found',
        routes: {
          upload: 'POST /upload',
          download: 'GET /files/:id',
        },
      },
      404,
      allowedOrigin,
    );
  },
};