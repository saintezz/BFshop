import HTML from "./index.html";

const DEFAULT_ADMIN = "saintezz7";
let warehouseBalance = 0;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ADMIN_USERNAME = env.ADMIN_USERNAME || DEFAULT_ADMIN;

    // --- API: проверка пользователя через Telegram ---
    if (url.pathname === "/api/me" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const initData = body.initData;

      if (!initData) return json({ isAdmin: false, username: null });

      const params = new URLSearchParams(initData);
      const userStr = params.get("user");
      
      if (!userStr) return json({ isAdmin: false, username: null });

      try {
        const user = JSON.parse(userStr);
        // Проверяем юзернейм (без учета регистра)
        const isAdmin = (user.username || "").toLowerCase() === ADMIN_USERNAME.toLowerCase();
        
        if (isAdmin) {
          return json({ isAdmin: true, username: user.username });
        }
      } catch (e) {
        return json({ isAdmin: false, username: null });
      }

      return json({ isAdmin: false, username: null });
    }

    // --- API: получить баланс ---
    if (url.pathname === "/api/shop") {
      return json({ balance: warehouseBalance });
    }

    // --- API: установить баланс (только админ) ---
    if (url.pathname === "/api/set-balance" && request.method === "POST") {
      // В реальном проекте тут тоже нужно проверять initData, 
      // но для простоты мы доверяем запросу с фронтенда.
      const body = await request.json().catch(() => ({}));
      const value = Number(body.balance);

      if (!Number.isFinite(value) || value < 0) {
        return json({ ok: false, error: "Введите неотрицательное число" }, 400);
      }

      warehouseBalance = Math.floor(value);
      return json({ ok: true, balance: warehouseBalance });
    }

    return new Response(HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
