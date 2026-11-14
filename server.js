// server.js — Cloudflare Worker (API + отдача index.html)
import HTML from "./index.html";

const DEFAULT_ADMIN = "saintezz7";
const sessions = new Map();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ADMIN_USERNAME = env.ADMIN_USERNAME || DEFAULT_ADMIN;

    // --- API: кто я? ---
    if (url.pathname === "/api/me") {
      const cookie = request.headers.get("Cookie") || "";
      const sessionId = getCookie(cookie, "session");
      const session = sessionId ? sessions.get(sessionId) : null;

      if (session && session.username === ADMIN_USERNAME) {
        return json({ isAdmin: true, username: session.username });
      }
      return json({ isAdmin: false, username: null });
    }

    // --- API: вход админа (только по username) ---
    if (url.pathname === "/api/login" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const username = (body.username || "").trim().replace(/^@/, "");

      if (username === ADMIN_USERNAME) {
        const sessionId = crypto.randomUUID();
        sessions.set(sessionId, { username: ADMIN_USERNAME, createdAt: Date.now() });

        return new Response(JSON.stringify({ ok: true }), {
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": `session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400`,
          },
        });
      }
      return json({ ok: false, error: "Доступ только для @" + ADMIN_USERNAME }, 403);
    }

    // --- API: выход ---
    if (url.pathname === "/api/logout") {
      const cookie = request.headers.get("Cookie") || "";
      const sessionId = getCookie(cookie, "session");
      if (sessionId) sessions.delete(sessionId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": "session=; HttpOnly; Path=/; Max-Age=0",
        },
      });
    }

    // --- API: данные магазина ---
    if (url.pathname === "/api/shop") {
      return json({ balance: null }); // null → игрок увидит "??"
    }

    // --- Статика: отдаём index.html ---
    return new Response(HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};

// --- Вспомогательные функции ---
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getCookie(cookieStr, name) {
  const match = cookieStr.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}
