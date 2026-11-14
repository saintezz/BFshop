// server.js — Cloudflare Worker (API + отдача index.html)
import HTML from "./index.html";

const DEFAULT_ADMIN = "saintezz7";
const sessions = new Map();

// Баланс "на складе" (в памяти; при перезапуске сбрасывается)
let warehouseBalance = null; // null → игрок видит "??"

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ADMIN_USERNAME = env.ADMIN_USERNAME || DEFAULT_ADMIN;

    if (url.pathname === "/api/me") {
      const session = getSession(request);
      if (session && session.username === ADMIN_USERNAME) {
        return json({ isAdmin: true, username: session.username });
      }
      return json({ isAdmin: false, username: null });
    }

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

    if (url.pathname === "/api/logout") {
      const session = getSession(request);
      if (session) sessions.delete(session.id);
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": "session=; HttpOnly; Path=/; Max-Age=0",
        },
      });
    }

    if (url.pathname === "/api/shop") {
      return json({ balance: warehouseBalance });
    }

    if (url.pathname === "/api/set-balance" && request.method === "POST") {
      const session = getSession(request);
      if (!session || session.username !== ADMIN_USERNAME) {
        return json({ ok: false, error: "Нет доступа" }, 403);
      }

      const body = await request.json().catch(() => ({}));
      const value = Number(body.balance);

      if (!Number.isFinite(value) || value < 0) {
        return json({ ok: false, error: "Введите неотрицательное число" }, 400);
      }

      warehouseBalance = Math.floor(value);
      return json({ ok: true, balance: warehouseBalance });
    }

    return new Response(HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};

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

function getSession(request) {
  const cookie = request.headers.get("Cookie") || "";
  const sessionId = getCookie(cookie, "session");
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  return session ? { ...session, id: sessionId } : null;
}
