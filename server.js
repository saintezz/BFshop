import HTML from "./index.html";

const ADMIN_PASSWORD = "SAINT333LARP";
let warehouseBalance = 0;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- API: проверка пароля ---
    if (url.pathname === "/api/login" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      if (body.password === ADMIN_PASSWORD) {
        return json({ ok: true });
      }
      return json({ ok: false, error: "Неверный пароль" }, 403);
    }

    // --- API: получить баланс ---
    if (url.pathname === "/api/shop") {
      return json({ balance: warehouseBalance });
    }

    // --- API: установить баланс ---
    if (url.pathname === "/api/set-balance" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      
      // Проверяем, что запрос содержит правильный пароль (защита от подделки)
      if (body.password !== ADMIN_PASSWORD) {
        return json({ ok: false, error: "Нет доступа" }, 403);
      }

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
