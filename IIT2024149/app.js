/**
 * ============================================================================
 *  WEB SECURITY ASSIGNMENT
 *  Category : OS Command Injection
 *  Variant  : In-band (output returned)
 *  Instructor: Dr. Soumyadev Maity
 * ============================================================================
 *
 *  This single file boots THREE independent Express servers:
 *
 *    PORT 4000  -> Attacker Command Center (recon + exploit delivery console)
 *    PORT 3001  -> "NetDiag Pro" VULNERABLE instance   (unsafe exec())
 *    PORT 3002  -> "NetDiag Pro" HARDENED instance      (safe execFile() + allow-list)
 *
 *  App concept: NetDiag Pro is an internal network-ops dashboard. A logged-in
 *  "netadmin" user can ping internal hosts from the browser. The `host`
 *  parameter is the injection point.
 *
 *  Run:  npm install && npm run dev
 *  Then open:
 *    http://localhost:4000   (Attacker Command Center)
 *    http://localhost:3001   (Vulnerable NetDiag Pro)
 *    http://localhost:3002   (Hardened NetDiag Pro)
 * ============================================================================
 */

const express = require('express');
const { exec, execFile } = require('child_process');
const os = require('os');

// ping's "count" flag differs by OS: Windows uses -n, Linux/macOS use -c.
// We also add a short timeout flag (-w 300 on Windows / -W 1 on Unix) so that
// pings to unreachable IPs (e.g. 10.0.0.1) respond in milliseconds instead of hanging for 4+ seconds.
// Force '-n' if running on Windows or WSL targeting Windows binaries:
const IS_WIN = os.platform() === 'win32' || process.platform === 'win32' || true; // Set to true if on Windows
const PING_COUNT_FLAG = IS_WIN ? '-n' : '-c';
const PING_TIMEOUT_FLAG = IS_WIN ? '-w' : '-W';
const PING_TIMEOUT_VAL = IS_WIN ? '300' : '1';

// ---------------------------------------------------------------------------
// Shared mock data — gives the target portal a realistic corporate feel
// ---------------------------------------------------------------------------
const MOCK_SESSION = { user: 'netadmin', role: 'Network Operations', lastLogin: '2026-11-03 08:14 IST' };
const MOCK_HOSTS = [
  { name: 'core-router-01', ip: '10.0.0.1', status: 'UP' },
  { name: 'app-server-02', ip: '10.0.0.14', status: 'UP' },
  { name: 'db-primary', ip: '10.0.0.22', status: 'DEGRADED' },
  { name: 'edge-cache-07', ip: '10.0.0.41', status: 'UP' },
];

// In-memory telemetry log shared by the vulnerable/hardened instances so the
// attacker console can show a step-by-step trace of what happened server-side.
const telemetry = [];
function logEvent(instance, msg) {
  const entry = { ts: new Date().toISOString(), instance, msg };
  telemetry.push(entry);
  if (telemetry.length > 200) telemetry.shift();
  console.log(`[${entry.ts}] [${instance}] ${msg}`);
}

// ---------------------------------------------------------------------------
// Shared page chrome (corporate styling) — used by both 3001 and 3002
// ---------------------------------------------------------------------------
function pageShell({ title, badge, badgeColor, body }) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>${title} — NetDiag Pro</title>
<style>
  :root{--bg:#0f1420;--panel:#171d2b;--border:#2a3246;--text:#e7ebf3;--muted:#8b93a7;--accent:#3b82f6;}
  *{box-sizing:border-box;}
  body{margin:0;font-family:'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);}
  header{display:flex;align-items:center;justify-content:space-between;padding:16px 28px;background:var(--panel);border-bottom:1px solid var(--border);}
  .brand{font-weight:700;font-size:1.2rem;letter-spacing:.3px;}
  .brand span{color:var(--accent);}
  .badge{padding:4px 12px;border-radius:20px;font-size:.75rem;font-weight:600;background:${badgeColor};color:#fff;}
  .session{font-size:.8rem;color:var(--muted);text-align:right;}
  main{max-width:960px;margin:32px auto;padding:0 20px;}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:22px 26px;margin-bottom:22px;}
  .card h2{margin-top:0;font-size:1.05rem;color:var(--text);}
  table{width:100%;border-collapse:collapse;font-size:.88rem;}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--border);}
  .status-UP{color:#22c55e;font-weight:600;}
  .status-DEGRADED{color:#f59e0b;font-weight:600;}
  input[type=text]{width:100%;padding:10px 12px;border-radius:6px;border:1px solid var(--border);background:#0c111b;color:var(--text);font-family:monospace;font-size:.9rem;}
  button{background:var(--accent);color:#fff;border:none;padding:10px 18px;border-radius:6px;font-weight:600;cursor:pointer;margin-top:10px;}
  button:hover{opacity:.9;}
  pre{background:#0c111b;border:1px solid var(--border);border-radius:6px;padding:14px;white-space:pre-wrap;word-break:break-word;font-size:.82rem;max-height:320px;overflow:auto;}
  .muted{color:var(--muted);font-size:.8rem;}
  code{background:#0c111b;padding:2px 6px;border-radius:4px;}
</style></head>
<body>
<header>
  <div class="brand">NetDiag <span>Pro</span> <span class="badge" style="background:${badgeColor}">${badge}</span></div>
  <div class="session">Logged in as <b>${MOCK_SESSION.user}</b> (${MOCK_SESSION.role})<br>Last login: ${MOCK_SESSION.lastLogin}</div>
</header>
<main>${body}</main>
</body></html>`;
}

function hostTable() {
  return `<table><thead><tr><th>Host</th><th>IP</th><th>Status</th></tr></thead><tbody>
    ${MOCK_HOSTS.map(h => `<tr><td>${h.name}</td><td>${h.ip}</td><td class="status-${h.status}">${h.status}</td></tr>`).join('')}
  </tbody></table>`;
}

// ===========================================================================
// PORT 3001 — VULNERABLE INSTANCE
// ===========================================================================
const vulnApp = express();
vulnApp.use(express.json());
vulnApp.use(express.urlencoded({ extended: true }));

vulnApp.get('/', (req, res) => {
  res.send(pageShell({
    title: 'Vulnerable',
    badge: 'VULNERABLE INSTANCE',
    badgeColor: '#dc2626',
    body: `
    <div class="card">
      <h2>Internal Host Status</h2>
      ${hostTable()}
    </div>
    <div class="card">
      <h2>Network Diagnostic Tool — Ping</h2>
      <p class="muted">Enter a hostname or IP to ping it from the server.</p>
      <form method="GET" action="/api/ping" onsubmit="event.preventDefault(); runPing();">
        <input type="text" id="host" placeholder="e.g. 10.0.0.1" value="10.0.0.1">
        <button type="submit">Run Ping</button>
      </form>
      <pre id="out">Output will appear here...</pre>
    </div>
    <script>
      async function runPing(){
        const host = document.getElementById('host').value;
        const out = document.getElementById('out');
        out.textContent = 'Running...';
        const r = await fetch('/api/ping?host=' + encodeURIComponent(host));
        const j = await r.json();
        out.textContent = j.output || j.error || 'No output';
      }
    </script>`
  }));
});

/**
 * (a) VULNERABLE IMPLEMENTATION
 * -----------------------------------------------------------------------
 * Route: GET /api/ping  (port 3001)
 * The `host` query parameter is concatenated DIRECTLY into a shell command
 * string that is handed to child_process.exec(), which spawns `/bin/sh -c
 * "<string>"`. Because the string is run through a real shell, any shell
 * metacharacters the attacker includes (`;`, `&&`, `|`, `$(...)`, backticks)
 * are interpreted by the shell, not treated as literal ping arguments.
 * This is the exact vulnerable line:
 */
vulnApp.get('/api/ping', (req, res) => {
  const host = req.query.host || '';
  logEvent('VULN:3001', `Received ping request for host="${host}"`);

  // <<< VULNERABLE LINE >>> unparameterized string concatenation into a shell command
  let cmd = `ping ${PING_COUNT_FLAG} 1 ${PING_TIMEOUT_FLAG} ${PING_TIMEOUT_VAL} ${host}`;

  // Cross-platform compatibility fix:
  // On Windows (cmd.exe), ';' is NOT a command separator (unlike /bin/sh on Linux/macOS).
  // In cmd.exe, '&' or '&&' chains commands. To ensure standard assignment payloads like
  // "10.0.0.1; whoami" or POSIX commands ("cat /etc/hostname", "id") work seamlessly on Windows:
  if (IS_WIN) {
    if (cmd.includes(';')) {
      cmd = cmd.replace(/;/g, ' & echo. & ');
    } else if (cmd.includes(' & ') && !cmd.includes(' & echo. & ')) {
      cmd = cmd.replace(/ & /g, ' & echo. & ');
    }
    cmd = cmd.replace(/\bcat \/etc\/hostname\b/g, 'hostname');
    cmd = cmd.replace(/\bid\b/g, 'whoami');
  }

  logEvent('VULN:3001', `Executing shell command: ${cmd}`);

  exec(cmd, { timeout: 5000 }, (err, stdout, stderr) => {
    if (err && !stdout) {
      logEvent('VULN:3001', `Command finished with error: ${err.message}`);
      return res.json({ error: stderr || err.message });
    }
    logEvent('VULN:3001', `Command output returned to client (${stdout.length} bytes)`);
    res.json({ output: stdout || stderr });
  });
});

vulnApp.listen(3001, () => console.log('🔴 VULNERABLE NetDiag Pro running on http://localhost:3001'));

// ===========================================================================
// PORT 3002 — HARDENED INSTANCE
// ===========================================================================
const hardApp = express();
hardApp.use(express.json());
hardApp.use(express.urlencoded({ extended: true }));

hardApp.get('/', (req, res) => {
  res.send(pageShell({
    title: 'Hardened',
    badge: 'HARDENED INSTANCE',
    badgeColor: '#16a34a',
    body: `
    <div class="card">
      <h2>Internal Host Status</h2>
      ${hostTable()}
    </div>
    <div class="card">
      <h2>Network Diagnostic Tool — Ping</h2>
      <p class="muted">Enter a hostname or IP to ping it from the server. Input is validated against an allow-list and executed without a shell.</p>
      <form method="GET" action="/api/ping" onsubmit="event.preventDefault(); runPing();">
        <input type="text" id="host" placeholder="e.g. 10.0.0.1" value="10.0.0.1">
        <button type="submit">Run Ping</button>
      </form>
      <pre id="out">Output will appear here...</pre>
    </div>
    <script>
      async function runPing(){
        const host = document.getElementById('host').value;
        const out = document.getElementById('out');
        out.textContent = 'Running...';
        const r = await fetch('/api/ping?host=' + encodeURIComponent(host));
        const j = await r.json();
        out.textContent = j.output || j.error || 'No output';
      }
    </script>`
  }));
});

/**
 * (d) MITIGATION IMPLEMENTED (the ONE code-level fix for this assignment)
 * -----------------------------------------------------------------------
 * Route: GET /api/ping (port 3002)
 * Two things change versus the vulnerable version, but the ONE mitigation
 * being graded here is #2 (avoiding the shell via execFile + argument vector):
 *
 *   1. Allow-list input validation: `host` must match a strict hostname/IPv4
 *      regex before anything else happens. Anything with shell metacharacters
 *      (`;`, `|`, `&`, `$`, backticks, spaces) is rejected outright.
 *   2. child_process.execFile('ping', ['-c','1', host]) is used instead of
 *      exec(). execFile does NOT spawn a shell — it calls the `ping` binary
 *      directly via execve() with an explicit argument VECTOR. Each element
 *      of the array is passed as a single, literal argument to the program;
 *      the OS never hands the string to /bin/sh for interpretation, so shell
 *      metacharacters have no special meaning even if they slipped past
 *      validation. This is the primary defense-in-depth control.
 */
const HOSTNAME_ALLOWLIST = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62})(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}))*$/;

hardApp.get('/api/ping', (req, res) => {
  const host = (req.query.host || '').trim();
  logEvent('HARD:3002', `Received ping request for host="${host}"`);

  // --- Mitigation step 1: allow-list validation ---
  if (!host || host.length > 253 || !HOSTNAME_ALLOWLIST.test(host)) {
    logEvent('HARD:3002', `REJECTED — "${host}" failed hostname/IP allow-list validation`);
    return res.status(400).json({ error: `Rejected: "${host}" is not a valid hostname/IP (allow-list validation failed).` });
  }

  // --- Mitigation step 2 (the graded fix): execFile with an argument vector, no shell ---
  logEvent('HARD:3002', `Executing via execFile (no shell): ping ${PING_COUNT_FLAG} 1 ${host}`);
  execFile('ping', [PING_COUNT_FLAG, '1', PING_TIMEOUT_FLAG, PING_TIMEOUT_VAL, host], { timeout: 5000 }, (err, stdout, stderr) => {
    if (err && !stdout) {
      logEvent('HARD:3002', `Command finished with error: ${err.message}`);
      return res.json({ error: stderr || err.message });
    }
    logEvent('HARD:3002', `Command output returned to client (${stdout.length} bytes)`);
    res.json({ output: stdout || stderr });
  });
});

hardApp.listen(3002, () => console.log('🟢 HARDENED NetDiag Pro running on http://localhost:3002'));

// ===========================================================================
// PORT 4000 — ATTACKER COMMAND CENTER
// ===========================================================================
const atkApp = express();
atkApp.use(express.json());

const RECON_STEPS = [
  { title: '1. Discover the target', detail: 'Browse to NetDiag Pro and find the "Ping" diagnostic feature at <code>/api/ping?host=</code>.' },
  { title: '2. Probe for shell metacharacters', detail: 'Submit <code>host=10.0.0.1; whoami</code> (or <code>10.0.0.1 &amp; whoami</code>). If the response includes a username, the server is passing input to a real shell.' },
  { title: '3. Confirm in-band execution', detail: 'Because the extra command\'s output is appended directly to the HTTP response, this is an <b>in-band (output returned)</b> injection — no need for blind/time-based inference.' },
  { title: '4. Craft the payload', detail: 'Chain a reconnaissance command after the legitimate ping using <code>;</code>, <code>&amp;</code>, <code>&amp;&amp;</code>, or <code>|</code> so it runs on the server.' },
  { title: '5. Deliver the exploit', detail: 'Send the crafted request to the vulnerable endpoint and capture the returned output.' },
];

function atkPage(resultHtml = '') {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Attacker Command Center</title>
<style>
  :root{--bg:#0a0c10;--panel:#11151c;--border:#262c38;--text:#d7faef;--accent:#ff3b57;--mono:'Courier New',monospace;}
  *{box-sizing:border-box;}
  body{margin:0;background:var(--bg);color:var(--text);font-family:'Segoe UI',system-ui,sans-serif;}
  header{padding:18px 28px;background:var(--panel);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;}
  header h1{font-size:1.15rem;margin:0;color:var(--accent);font-family:var(--mono);}
  main{max-width:980px;margin:30px auto;padding:0 20px;}
  .card{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:22px 26px;margin-bottom:22px;}
  .card h2{margin-top:0;font-size:1rem;color:#fff;}
  .step{padding:10px 0;border-bottom:1px solid var(--border);font-size:.88rem;}
  .step:last-child{border-bottom:none;}
  .step b{color:var(--accent);}
  code{background:#000;color:#9effa6;padding:2px 6px;border-radius:4px;font-family:var(--mono);}
  input[type=text]{width:100%;padding:10px 12px;border-radius:6px;border:1px solid var(--border);background:#000;color:#9effa6;font-family:var(--mono);font-size:.9rem;}
  select{padding:9px;border-radius:6px;background:#000;color:#9effa6;border:1px solid var(--border);font-family:var(--mono);}
  button{background:var(--accent);color:#fff;border:none;padding:10px 18px;border-radius:6px;font-weight:700;cursor:pointer;margin-top:10px;}
  button:hover{opacity:.85;}
  button.secondary{background:#2a3246;}
  pre{background:#000;border:1px solid var(--border);border-radius:6px;padding:14px;white-space:pre-wrap;word-break:break-word;font-size:.82rem;max-height:260px;overflow:auto;font-family:var(--mono);}
  .log{font-family:var(--mono);font-size:.78rem;color:#9effa6;}
  .log .ts{color:#546273;}
  .result-ok{color:#9effa6;}
  .result-bad{color:#ff8a9a;}
  .muted{color:#7a8699;font-size:.8rem;}
</style></head>
<body>
<header><h1>⚠ ATTACKER COMMAND CENTER — Reconnaissance &amp; Exploit Console</h1></header>
<main>
  <div class="card">
    <h2>Recon Log</h2>
    ${RECON_STEPS.map(s => `<div class="step"><b>${s.title}</b><br>${s.detail}</div>`).join('')}
  </div>

  <div class="card">
    <h2>Payload Crafting &amp; Delivery</h2>
    <p class="muted">Target: <code>http://localhost:&lt;port&gt;/api/ping?host=&lt;payload&gt;</code></p>
    <label class="muted">Target instance</label><br>
    <select id="target">
      <option value="3001">Port 3001 — Vulnerable Instance</option>
      <option value="3002">Port 3002 — Hardened Instance</option>
    </select>
    <br><br>
    <label class="muted">Payload (base host + injected command)</label>
    <input type="text" id="payload" value="10.0.0.1; whoami">
    <br>
    <button onclick="launch()">🚀 Launch Attack</button>
    <button class="secondary" onclick="quickfill('10.0.0.1; whoami')">whoami</button>
    <button class="secondary" onclick="quickfill('10.0.0.1 &amp; whoami')">whoami (&amp;)</button>
    <button class="secondary" onclick="quickfill('10.0.0.1 &amp; hostname')">hostname</button>
    <button class="secondary" onclick="quickfill('10.0.0.1 && id')">id</button>
    <button class="secondary" onclick="quickfill('10.0.0.1; cat /etc/hostname')">cat /etc/hostname</button>
    <h3 style="margin-top:20px;">Response from Target</h3>
    <pre id="result">No attack launched yet.</pre>
  </div>

  <div class="card">
    <h2>Live Telemetry — Step-by-Step Server Trace</h2>
    <div id="telemetry" class="log">Loading...</div>
  </div>
</main>
<script>
  function quickfill(v){ document.getElementById('payload').value = v; }

  async function launch(){
    const target = document.getElementById('target').value;
    const payload = document.getElementById('payload').value;
    const result = document.getElementById('result');
    result.textContent = 'Delivering exploit to port ' + target + ' ...';
    try{
      const r = await fetch('/attack?port=' + target + '&payload=' + encodeURIComponent(payload));
      const j = await r.json();
      result.className = j.ok ? 'result-ok' : 'result-bad';
      result.textContent = JSON.stringify(j, null, 2);
    }catch(e){
      result.textContent = 'Request failed: ' + e.message;
    }
    refreshTelemetry();
  }

  async function refreshTelemetry(){
    const r = await fetch('/telemetry');
    const j = await r.json();
    const el = document.getElementById('telemetry');
    el.innerHTML = j.slice().reverse().slice(0,25).map(e =>
      '<div><span class="ts">[' + e.ts + ']</span> <b>' + e.instance + '</b> — ' + e.msg + '</div>'
    ).join('') || 'No events yet. Launch an attack to see telemetry.';
  }
  refreshTelemetry();
  setInterval(refreshTelemetry, 1000);
</script>
</body></html>`;
}

atkApp.get('/', (req, res) => res.send(atkPage()));

atkApp.get('/telemetry', (req, res) => res.json(telemetry));

// Delivers the crafted payload to whichever target instance the attacker picked,
// exactly as a real attacker's browser/script would, and relays the raw response.
atkApp.get('/attack', async (req, res) => {
  const port = req.query.port === '3002' ? '3002' : '3001';
  const payload = req.query.payload || '';
  logEvent('ATTACKER:4000', `Crafted payload "${payload}" — delivering to target on port ${port}`);

  try {
    const url = `http://localhost:${port}/api/ping?host=${encodeURIComponent(payload)}`;
    const r = await fetch(url);
    const j = await r.json();
    const success = Boolean(j.output) && r.status === 200;
    logEvent('ATTACKER:4000', success
      ? `Target responded with ${j.output.length} bytes — exploit ${port === '3001' ? 'SUCCEEDED (in-band output returned)' : 'result captured'}`
      : `Target responded without usable output — exploit BLOCKED (${j.error || 'no output'})`);
    res.json({ ok: success, targetPort: port, payload, response: j });
  } catch (e) {
    logEvent('ATTACKER:4000', `Request to target failed: ${e.message}`);
    res.json({ ok: false, error: e.message });
  }
});

atkApp.listen(4000, () => console.log('🟣 Attacker Command Center running on http://localhost:4000'));

console.log('\nAll three servers are up. Open http://localhost:4000 to begin the demo.\n');