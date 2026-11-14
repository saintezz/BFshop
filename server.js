import HTML from "./index.html";

const DEFAULT_ADMIN = "saintezz7";
const sessions = new Map(); // В памяти (сбрасывается при рестарте)
let warehouseBalance = 0;   // По умолчанию 0

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ADMIN_USERNAME = env.ADMIN_USERNAME || DEFAULT_ADMIN;

    // --- API: кто я? (проверка через Telegram initData) ---
    if (url.pathname === "/api/me" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const initData = body.initData;

      if (!initData) return json({ isAdmin: false, username: null });

      // Парсим initData от Telegram
      const params = new URLSearchParams(initData);
      const userStr = params.get("user");
      
      if (!userStr) return json({ isAdmin: false, username: null });

      try {
        const user = JSON.parse(userStr);
        const isAdmin = (user.username || "").toLowerCase() === ADMIN_USERNAME.toLowerCase();

        if (isAdmin) {
          // Создаём сессию для админа
          const sessionId = crypto.randomUUID();
          sessions.set(sessionId, { username: ADMIN_USERNAME, createdAt: Date.now() });
          
          return new Response(JSON.stringify({ isAdmin: true, username: user.username }), {
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": `session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400`,
            },
          });
        }
      } catch (e) {
        return json({ isAdmin: false, username: null });
      }

      return json({ isAdmin: false, username: null });
    }

    // --- API: выход ---
    if (url.pathname === "/api/logout" && request.method === "POST") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": "session=; HttpOnly; Path=/; Max-Age=0",
        },
      });
    }

    // --- API: получить баланс ---
    if (url.pathname === "/api/shop") {
      return json({ balance: warehouseBalance });
    }

    // --- API: установить баланс (только админ) ---
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

    // --- Статика ---
    return new Response(HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
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
