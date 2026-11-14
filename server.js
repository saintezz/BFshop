// server.js — Cloudflare Worker (без пароля, вход по username)
// Переменная окружения (необязательно):
//   ADMIN_USERNAME = "saintezz7"

const DEFAULT_ADMIN = "saintezz7";

// Сессии в памяти Worker (для демо; при перезапуске сбрасываются)
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

    // --- API: вход админа (только по username, без пароля) ---
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

    // --- API: данные магазина (баланс игрока) ---
    if (url.pathname === "/api/shop") {
      // Пока заглушка: баланс неизвестен → игрок увидит "??"
      return json({ balance: null });
    }

    // --- Статика: отдаём HTML ---
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

// --- HTML страницы ---
const HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BrainrotFarmShop</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#000; color:#fff; font-family:'Segoe UI',Tahoma,sans-serif; min-height:100vh; overflow-x:hidden; }
  .top-bar { position:fixed; top:0; left:50%; transform:translateX(-50%); z-index:100; line-height:0; }
  .logo { width:220px; height:220px; object-fit:contain; display:block; margin-top:-80px; }
  .tabs { position:fixed; top:20px; right:20px; display:flex; gap:10px; z-index:100; }
  .tab-btn { background:#111; border:1px solid #222; color:#aaa; padding:10px 18px; border-radius:8px; cursor:pointer; font-size:14px; }
  .tab-btn.active { border-color:#FFD700; color:#FFD700; }
  .panel { max-width:700px; margin:260px auto 40px; padding:30px; background:#0a0a0a; border:1px solid #1a1a1a; border-radius:16px; }
  .panel h2 { color:#FFD700; margin-bottom:16px; font-size:22px; }
  .coins { font-size:36px; font-weight:700; color:#FFD700; margin:20px 0; }
  .coins .unknown { color:#666; }
  .muted { color:#777; font-size:14px; }
  .admin-only { display:none; }
  .admin-only.visible { display:block; }
  .login-form { display:flex; flex-direction:column; gap:12px; max-width:300px; }
  .login-form input { background:#111; border:1px solid #222; color:#fff; padding:12px; border-radius:8px; }
  .login-form button { background:#FFD700; color:#000; border:none; padding:12px; border-radius:8px; font-weight:700; cursor:pointer; }
  .error { color:#e74c3c; font-size:14px; }
</style>
</head>
<body>

<div class="top-bar">
  <img src="https://raw.githubusercontent.com/saintezz/BFshop/main/LOGO.png" alt="BFshop" class="logo">
</div>

<div class="tabs">
  <button class="tab-btn active" data-tab="shop">🛒 Магазин</button>
  <button class="tab-btn" data-tab="coins" id="coinsTabBtn">💰 Показатель монет</button>
</div>

<!-- ПАНЕЛЬ: МАГАЗИН (видят все) -->
<div class="panel" id="panel-shop">
  <h2>Магазин</h2>
  <p class="muted">Монет на складе: <span id="playerBalance" class="unknown">??</span></p>
</div>

<!-- ПАНЕЛЬ: ПОКАЗАТЕЛЬ МОНЕТ (только для админов) -->
<div class="panel admin-only" id="panel-coins-admin">
  <h2>👑 Показатель монет (админ)</h2>
  <div id="adminNotLogged" class="login-form">
    <p class="muted">Войдите как @saintezz7 (пароль не нужен)</p>
    <input type="text" id="loginUsername" placeholder="Введите @saintezz7" autocomplete="username">
    <button onclick="doLogin()">Войти</button>
    <p class="error" id="loginError"></p>
  </div>
  <div id="adminLogged" style="display:none;">
    <p class="muted">Вы вошли как <b id="adminName"></b></p>
    <div class="coins" id="adminCoins">—</div>
    <p class="muted">Здесь будет отображаться общий показатель монет по всем игрокам.</p>
    <button class="tab-btn" onclick="doLogout()" style="margin-top:16px;">Выйти</button>
  </div>
</div>

<script>
  let isAdmin = false;

  fetch('/api/me').then(r => r.json()).then(data => {
    isAdmin = data.isAdmin;
    updateAdminUI(data.username);
    if (isAdmin) {
      document.getElementById('coinsTabBtn').textContent = '👑 Показатель монет';
    }
  });

  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');

      const tab = btn.dataset.tab;
      if (tab === 'shop') {
        document.getElementById('panel-shop').style.display = 'block';
      } else if (tab === 'coins') {
        if (isAdmin) {
          document.getElementById('panel-coins-admin').classList.add('visible');
          document.getElementById('panel-coins-admin').style.display = 'block';
        } else {
          document.getElementById('panel-shop').style.display = 'block';
          document.getElementById('playerBalance').textContent = '??';
        }
      }
    });
  });

  function updateAdminUI(username) {
    if (isAdmin) {
      document.getElementById('adminNotLogged').style.display = 'none';
      document.getElementById('adminLogged').style.display = 'block';
      document.getElementById('adminName').textContent = '@' + (username || 'saintezz7');
      document.getElementById('adminCoins').textContent = '1000 🪙';
    } else {
      document.getElementById('adminNotLogged').style.display = 'block';
      document.getElementById('adminLogged').style.display = 'none';
    }
  }

  async function doLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    if (data.ok) {
      isAdmin = true;
      document.getElementById('loginError').textContent = '';
      updateAdminUI(username);
    } else {
      document.getElementById('loginError').textContent = data.error || 'Ошибка входа';
    }
  }

  async function doLogout() {
    await fetch('/api/logout');
    isAdmin = false;
    updateAdminUI(null);
  }
</script>
</body>
</html>`;
