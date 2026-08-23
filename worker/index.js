const SECURITY_HEADERS = {
  "Content-Security-Policy": "frame-ancestors 'none';",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function withSecurityHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  if (pathname === "/release.json") {
    headers.set("Cache-Control", "no-store");
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function internalAssetRequest(request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url, request);
}

function routeDocumentPath(pathname) {
  const normalizedPath = pathname === "/" ? "" : pathname.replace(/\/+$/, "");
  return `/__pages${normalizedPath}/`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");
    const canServeDocument = acceptsHtml && ["GET", "HEAD"].includes(request.method);
    let response;

    if (url.pathname === "/release.json" && ["GET", "HEAD"].includes(request.method)) {
      response = await env.ASSETS.fetch(internalAssetRequest(request, "/__pages/release.json"));
    } else {
      response = await env.ASSETS.fetch(request);
    }

    if (response.status === 404 && canServeDocument) {
      response = await env.ASSETS.fetch(internalAssetRequest(request, routeDocumentPath(url.pathname)));
    }

    if (response.status === 404 && canServeDocument && url.pathname !== "/") {
      response = await env.ASSETS.fetch(internalAssetRequest(request, "/__pages/index.html"));
    }

    return withSecurityHeaders(response, url.pathname);
  },
};
