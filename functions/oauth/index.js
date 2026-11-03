const crypto = require("node:crypto");

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const SITE_ORIGIN = process.env.SITE_ORIGIN || "*";

function response(statusCode, headers, body) {
  return { statusCode, headers: { "Cache-Control": "no-store", ...headers }, body };
}

function html(statusCode, body, extraHeaders = {}) {
  return response(statusCode, { "Content-Type": "text/html; charset=utf-8", ...extraHeaders }, body);
}

function readCookie(event, name) {
  const headers = event.headers || {};
  const cookie = headers.cookie || headers.Cookie || "";
  return cookie.split(/;\s*/).find(item => item.startsWith(`${name}=`))?.split("=")[1];
}

function resultPage({ token, error }) {
  const message = token
    ? `authorization:github:success:${JSON.stringify({ token, provider: "github" })}`
    : `authorization:github:error:${JSON.stringify({ message: error || "OAuth failed" })}`;
  return `<!doctype html><meta charset="utf-8"><title>正在完成授权</title><p>${token ? "授权成功，正在返回内容管理页…" : "授权失败，请关闭窗口后重试。"}</p><script>
    (function () {
      var message = ${JSON.stringify(message)};
      if (window.opener) {
        window.opener.postMessage(message, ${JSON.stringify(SITE_ORIGIN)});
        window.close();
      }
    })();
  </script>`;
}

async function exchangeCode(code) {
  const result = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "finn-catalog-oauth" },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code })
  });
  if (!result.ok) throw new Error(`GitHub token exchange failed: ${result.status}`);
  const data = await result.json();
  if (!data.access_token) throw new Error(data.error_description || data.error || "No access token returned");
  return data.access_token;
}

exports.main_handler = async (event) => {
  if (!CLIENT_ID || !CLIENT_SECRET) return html(500, resultPage({ error: "Server OAuth environment variables are missing" }));
  const query = event.queryStringParameters || event.queryString || {};
  const path = event.path || event.requestContext?.path || "/auth";
  const isCallback = path.endsWith("/callback") || Object.hasOwn(query, "code");

  if (!isCallback) {
    const state = crypto.randomBytes(20).toString("hex");
    const callbackUrl = process.env.GITHUB_CALLBACK_URL;
    if (!callbackUrl) return html(500, resultPage({ error: "GITHUB_CALLBACK_URL is missing" }));
    const params = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: callbackUrl, scope: "repo", state });
    return response(302, {
      Location: `https://github.com/login/oauth/authorize?${params}`,
      "Set-Cookie": `decap_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`
    }, "");
  }

  try {
    if (!query.code || !query.state || query.state !== readCookie(event, "decap_oauth_state")) {
      throw new Error("OAuth state validation failed");
    }
    const token = await exchangeCode(query.code);
    return html(200, resultPage({ token }), { "Set-Cookie": "decap_oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/" });
  } catch (error) {
    console.error("OAuth callback failed:", error.message);
    return html(400, resultPage({ error: error.message }));
  }
};
