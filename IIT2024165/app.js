/**
 * SQL Injection Authentication Bypass Lab
 * Instructor: Dr. Soumyadev Maity | Student: Shivam Kumar (IIT2024165)
 *
 * This program intentionally runs ONLY mock services on localhost. It is a
 * controlled learning lab, not a scanner and not a tool for real systems.
 * Start: npm install, then npm run dev
 * Ports: 4000 attacker command center | 3001 vulnerable | 3002 hardened
 */
const express = require('express');
const Database = require('better-sqlite3');
const http = require('node:http');

const VULNERABLE_PORT = 3001;
const HARDENED_PORT = 3002;
const ATTACKER_PORT = 4000;

// An in-memory database means every run starts with the same harmless mock data.
const db = new Database(':memory:');
db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    balance REAL NOT NULL
  );
  INSERT INTO users (username, password, full_name, role, balance) VALUES
    ('admin', 'Admin#2026!', 'Aarav Mehta', 'System Administrator', 250000.00),
    ('priya', 'Priya#2026!', 'Priya Sharma', 'Customer', 12450.75),
    ('shivam', 'Demo#2026!', 'Shivam Kumar', 'Student Demo Account', 8400.00);
`);

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function serverStatus() {
  return `<span class="status-dot"></span> All services operational`;
}

function page(title, environment, content, extraScript = '') {
  return `<!doctype html>
  <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title><style>
    :root { --navy:#0b1f3a; --blue:#1769e0; --ink:#13233a; --muted:#66768d; --line:#dbe4f0; --paper:#fff; --bg:#f4f7fb; --green:#138a5b; --red:#c2364f; --amber:#b7791f; }
    * { box-sizing:border-box } body { margin:0; font:15px/1.5 Inter,Segoe UI,Arial,sans-serif; color:var(--ink); background:var(--bg) }
    header { background:var(--navy); color:white; padding:16px 7%; display:flex; align-items:center; justify-content:space-between; gap:16px }
    .brand { display:flex; align-items:center; gap:10px; font-weight:700; font-size:18px }.shield { width:29px;height:33px;display:grid;place-items:center;background:#1b66bd;clip-path:polygon(50% 0,94% 16%,86% 75%,50% 100%,14% 75%,6% 16%);font-size:14px }
    .env { border:1px solid #7894bd; border-radius:99px; padding:4px 10px; font-size:12px; font-weight:700; letter-spacing:.4px }.env.vuln{background:#69263a;border-color:#bd6680}.env.safe{background:#155a47;border-color:#4aaa87}.env.attack{background:#3b3174;border-color:#887cd2}
    main { max-width:1120px; margin:42px auto; padding:0 24px }.eyebrow { color:var(--blue); font-weight:700; font-size:12px; letter-spacing:1px; text-transform:uppercase }.hero { display:grid; grid-template-columns:1.1fr .9fr; gap:32px; align-items:start }
    h1 { font-size:34px; margin:6px 0 12px; line-height:1.18 } h2 { font-size:20px;margin:0 0 18px } p { color:var(--muted) }.card { background:var(--paper); border:1px solid var(--line); border-radius:14px; padding:28px; box-shadow:0 6px 20px #193b6810 }
    .login { max-width:435px }.field { margin:15px 0 }.field label { display:block;font-weight:650;margin-bottom:7px }.field input { width:100%;border:1px solid #bdcadd;border-radius:8px;padding:12px;font:inherit;outline:none }.field input:focus { border-color:var(--blue); box-shadow:0 0 0 3px #1769e022 }
    button,.button { cursor:pointer;border:0;border-radius:8px;background:var(--blue);color:white;padding:12px 16px;font:700 14px inherit;text-decoration:none;display:inline-block }.button.secondary { background:white;border:1px solid #bdcadd;color:var(--ink) }.notice { margin-top:17px;padding:12px 14px;border-radius:8px;font-size:14px }.notice.error { color:#8d1931;background:#fff0f3;border:1px solid #ffc7d2 }.notice.ok { color:#096540;background:#eafaf3;border:1px solid #b9ead4 }.notice.warn { color:#80540e;background:#fff8e8;border:1px solid #f1d28d }
    .meta { display:grid; grid-template-columns:repeat(3,1fr);gap:12px;margin-top:24px }.stat { border:1px solid var(--line);border-radius:9px;padding:13px }.stat b { display:block;font-size:17px }.stat span { font-size:12px;color:var(--muted) }.status-dot { display:inline-block;width:8px;height:8px;background:#35c78a;border-radius:50%;margin-right:6px }
    .demo-only { border-left:4px solid var(--amber);background:#fff9e9;padding:13px 15px;border-radius:6px;margin:18px 0;color:#78500f;font-size:14px }.account { display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:20px }.account .stat { background:#f8fbff }.code { background:#101d31;color:#dceaff;border-radius:8px;padding:13px;overflow:auto;font:13px/1.5 Consolas,monospace;white-space:pre-wrap }.muted { font-size:12px;color:var(--muted) }
    .console-grid { display:grid;grid-template-columns:1fr 1fr;gap:22px }.steps { margin:0;padding:0;list-style:none;counter-reset:step }.steps li { counter-increment:step; padding:12px 0 12px 39px;position:relative;border-bottom:1px solid var(--line) }.steps li:before { content:counter(step);position:absolute;left:0;top:11px;width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:#e6efff;color:var(--blue);font-weight:bold;font-size:12px }.log { height:280px;overflow:auto;background:#0e1727;color:#cbe0ff;border-radius:9px;padding:14px;font:12px/1.55 Consolas,monospace }.log div { padding:3px 0 }.log .time { color:#8094b3 }.log .success { color:#78e3b2 }.log .danger { color:#ff9fac }
    footer { text-align:center;color:var(--muted);font-size:12px;padding:24px } @media(max-width:760px){.hero,.console-grid{grid-template-columns:1fr}.meta{grid-template-columns:1fr}header{padding:14px 5%}main{margin:25px auto}}
  </style></head><body><header><div class="brand"><span class="shield">◆</span> Meridian Secure Portal</div><span class="env ${environment.class}">${environment.label}</span></header><main>${content}</main><footer>Controlled academic demonstration · localhost only · Dr. Soumyadev Maity</footer>${extraScript}</body></html>`;
}

function targetHome(kind, message = '') {
  const isVulnerable = kind === 'vulnerable';
  const env = isVulnerable ? { class: 'vuln', label: 'VULNERABLE INSTANCE · :3001' } : { class: 'safe', label: 'HARDENED INSTANCE · :3002' };
  const port = isVulnerable ? VULNERABLE_PORT : HARDENED_PORT;
  const alert = message ? `<div class="notice ${message.type}">${message.text}</div>` : '';
  return page('Meridian Login', env, `<div class="hero"><section><div class="eyebrow">Client access</div><h1>Welcome to Meridian</h1><p>Sign in to view your account overview, balances, and recent activity.</p><div class="meta"><div class="stat"><b>99.98%</b><span>Platform availability</span></div><div class="stat"><b>256-bit</b><span>Transport encryption</span></div><div class="stat"><b>${serverStatus()}</b><span>Live status</span></div></div></section><section class="card login"><h2>Secure sign in</h2>${isVulnerable ? '<div class="demo-only"><b>Academic lab marker:</b> this is an intentionally vulnerable mock login. Use only the supplied localhost attacker console.</div>' : '<div class="notice ok"><b>Defense enabled:</b> authentication uses a parameterized database query.</div>'}<form method="post" action="/login"><div class="field"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required placeholder="Enter your username"></div><div class="field"><label for="password">Password</label><input id="password" type="password" name="password" autocomplete="current-password" required placeholder="Enter your password"></div><button type="submit">Sign in securely</button></form>${alert}<p class="muted">Environment: localhost:${port} · Mock credentials are provided only for the lab.</p></section></div>`);
}

function dashboard(kind, user) {
  const isVulnerable = kind === 'vulnerable';
  const env = isVulnerable ? { class: 'vuln', label: 'VULNERABLE INSTANCE · :3001' } : { class: 'safe', label: 'HARDENED INSTANCE · :3002' };
  return page('Meridian Account Overview', env, `<div class="eyebrow">Authenticated session</div><h1>Good morning, ${escapeHtml(user.full_name)}</h1><p>Your personal financial overview is ready.</p>${isVulnerable ? '<div class="notice warn"><b>Lab observation:</b> this session was granted by the vulnerable authentication handler. Inspect the attacker console telemetry for the evidence trail.</div>' : ''}<div class="account"><div class="stat"><span>Available balance</span><b>₹${Number(user.balance).toLocaleString('en-IN', {minimumFractionDigits:2})}</b></div><div class="stat"><span>Account role</span><b>${escapeHtml(user.role)}</b></div><div class="stat"><span>Account number</span><b>•••• 4187</b></div><div class="stat"><span>Service status</span><b>${serverStatus()}</b></div></div><div class="card" style="margin-top:24px"><h2>Recent activity</h2><p>02 Nov 2026 · Scheduled transfer processed · ₹1,250.00</p><p>01 Nov 2026 · Statement generated · No action required</p></div><p><a class="button secondary" href="/">Sign out</a></p>`);
}

function createTarget(kind) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.get('/', (req, res) => res.send(targetHome(kind)));
  app.post('/login', (req, res) => {
    const username = req.body.username || '';
    const password = req.body.password || '';
    let user;
    if (kind === 'vulnerable') {
      // VULNERABILITY (Rubric a): untrusted values are concatenated directly into SQL.
      // Payload: ' OR '1'='1' --  makes the WHERE condition true and comments out password.
      const insecureSql = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}' LIMIT 1`;
      try { user = db.prepare(insecureSql).get(); } catch (_) { user = undefined; }
    } else {
      // THE SINGLE IMPLEMENTED MITIGATION: parameterized query / bound parameters.
      // User input stays data, never becomes executable SQL syntax.
      user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ? LIMIT 1').get(username, password);
    }
    if (user) return res.send(dashboard(kind, user));
    res.status(401).send(targetHome(kind, { type: 'error', text: 'Sign-in unsuccessful. Please check your credentials and try again.' }));
  });
  return app;
}

const attacker = express();
attacker.use(express.json());
attacker.get('/', (req, res) => res.send(page('Attacker Command Center', { class: 'attack', label: 'ATTACKER COMMAND CENTER · :4000' }, `<div class="eyebrow">Authorized training simulation</div><h1>Authentication bypass reconnaissance</h1><p>Controlled delivery console for the local Meridian lab. This console sends no requests to external hosts.</p><div class="console-grid"><section class="card"><h2>Exploit delivery</h2><ol class="steps"><li>Identify the target login endpoint: <code>POST /login</code></li><li>Choose the <code>username</code> parameter as the test input.</li><li>Use the Boolean payload below to alter the vulnerable SQL condition.</li><li>Deliver it to either local instance and compare results.</li></ol><div class="field"><label for="payload">Username payload</label><input id="payload" value="' OR '1'='1' -- "></div><div class="field"><label for="attemptPassword">Password (ignored by bypass on :3001)</label><input id="attemptPassword" value="not-the-password"></div><p><button onclick="launch(3001, 'Vulnerable target')">Launch against :3001</button> <button class="button secondary" onclick="launch(3002, 'Hardened target')">Test against :3002</button></p><p class="muted">Expected: :3001 opens a mock admin dashboard; :3002 returns a generic login failure.</p></section><section class="card"><h2>Live telemetry</h2><div id="log" class="log" aria-live="polite"><div><span class="time">[ready]</span> Command center initialized.</div><div><span class="time">[scope]</span> Local targets authorized: localhost:3001, localhost:3002.</div></div><p class="muted">Telemetry is browser-local and records the simulation steps for your demo.</p></section></div>`, `<script>
function add(message, cls=''){const log=document.getElementById('log');const t=new Date().toLocaleTimeString();const d=document.createElement('div');d.className=cls;d.innerHTML='<span class="time">['+t+']</span> '+message;log.appendChild(d);log.scrollTop=log.scrollHeight}
function launch(port,label){const payload=document.getElementById('payload').value;const pwd=document.getElementById('attemptPassword').value;add('Recon: POST /login found on localhost:'+port);add('Crafted username payload: <code>'+payload.replace(/</g,'&lt;')+'</code>');add('Delivery: submitting form to '+label+'…',port===3001?'danger':'');setTimeout(()=>add(port===3001?'Result expected: vulnerable SQL condition becomes true; dashboard should load.':'Result expected: bound parameters preserve payload as text; sign-in should fail.',port===3001?'success':'success'),350);const f=document.createElement('form');f.method='POST';f.action='http://localhost:'+port+'/login';f.target='_blank';for(const [n,v] of [['username',payload],['password',pwd]]){const i=document.createElement('input');i.type='hidden';i.name=n;i.value=v;f.appendChild(i)}document.body.appendChild(f);f.submit();f.remove()}
</script>`)));

function startServer(app, port, label) {
  const server = http.createServer(app);
  server.on('error', error => {
    console.error(`${label} could not start on port ${port}: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    // Keep an explicit reference to each listener so the dev process remains alive.
    server.ref();
    console.log(`${label}: http://localhost:${port}`);
  });
  return server;
}

const servers = [
  startServer(createTarget('vulnerable'), VULNERABLE_PORT, 'Vulnerable portal'),
  startServer(createTarget('hardened'), HARDENED_PORT, 'Hardened portal'),
  startServer(attacker, ATTACKER_PORT, 'Attacker console')
];

// Retain listener references for the lifetime of the single `npm run dev` process.
process.on('SIGINT', () => {
  console.log('\nStopping the SQLi demo servers…');
  for (const server of servers) server.close();
  db.close();
});
