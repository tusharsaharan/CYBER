// =============================================================================
//  CYBERSECURITY LAB: REFLECTED CROSS-SITE SCRIPTING (XSS) DEMONSTRATION
//  FULL TWO-SIDED ARCHITECTURE WITH LIVE ATTACKER CONSOLE & CAMPAIGN TELEMETRY
// =============================================================================
//
//  Course           : Web Server Vulnerabilities & Defense
//  Category         : Cross-Site Scripting (XSS)
//  Variant          : Reflected XSS
//  Target System    : Apex Trust Online Banking
//  Instructor       : Dr. Soumyadev Maity
//  Submission Due   : 03 November 2026, 23:59
//
//  Port Architecture:
//    • Port 4000 → ATTACKER SIDE: Phishing Portal, Live Telemetry & Vector Matrix
//    • Port 3001 → USER SIDE: Apex Trust Online Banking (Vulnerable Instance)
//    • Port 3002 → USER SIDE: Apex Trust Online Banking (Secured / Hardened Instance)
//
// =============================================================================

const express = require("express");

// -----------------------------------------------------------------------------
// HTML ENTITY ENCODER (USED BY SECURE INSTANCE AND PREVIEWS)
// -----------------------------------------------------------------------------
function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// -----------------------------------------------------------------------------
// SHARED MOCK DATA: SIMULATED BANKING LEDGER
// -----------------------------------------------------------------------------
const MOCK_ACCOUNT = {
  holder: "Alex Mercer",
  accountNumber: "ACT-8492-9102",
  accountType: "Premier Checking",
  balance: "$14,820.50",
  routingNumber: "021000089",
};

const MOCK_TRANSACTIONS = [
  { id: "TX-1001", date: "2026-11-01", description: "Direct Deposit - Global Tech Payroll", category: "Income", amount: "+$4,500.00" },
  { id: "TX-1002", date: "2026-10-30", description: "Metropolitan Utility Service - Electricity", category: "Utilities", amount: "-$145.20" },
  { id: "TX-1003", date: "2026-10-28", description: "Whole Foods Market - Groceries", category: "Food & Dining", amount: "-$86.40" },
  { id: "TX-1004", date: "2026-10-25", description: "Apex Mortgage Transfer", category: "Housing", amount: "-$1,850.00" },
  { id: "TX-1005", date: "2026-10-22", description: "Cloudflare Subscription", category: "Services", amount: "-$20.00" },
];

// -----------------------------------------------------------------------------
// FOUR DISTINCT REFLECTED XSS USE CASES & VECTORS
// -----------------------------------------------------------------------------
const USE_CASES = [
  {
    id: "usecase-1",
    name: "Use Case 1: Standard Script Tag Execution",
    subtitle: "Classic Script Tag Injection in Element Body",
    description: "The payload injects a standard <script> tag into the HTML element body (<div>${query}</div>). Demonstrates that the browser executes arbitrary JavaScript in the application's origin context.",
    payload: "<script>alert('🚨 Use Case 1 Executed!\\n\\nOrigin: ' + document.domain + '\\nStandard script tag parsed in HTML body.')</script>",
  },
  {
    id: "usecase-2",
    name: "Use Case 2: DOM Defacement & Visual Tampering",
    subtitle: "Altering What the User Sees in the UI (No Alert Dialog)",
    description: "Instead of a pop-up dialog, the injected script dynamically modifies the bank's DOM elements: it changes the user's balance to $0.00 and alters the account status banner to a fake 'ACCOUNT FROZEN' emergency notice.",
    payload: "<script>document.getElementById('display-balance').innerText='$0.00'; document.getElementById('account-status').innerHTML='<span style=\"color:#ef4444; font-weight:800; background:#fee2e2; padding:2px 8px; border-radius:4px;\">⚠️ FROZEN (UNDER INVESTIGATION)</span>'; document.getElementById('security-banner').innerHTML='<div style=\"background:#dc2626; color:white; padding:12px; border-radius:6px; font-weight:700;\">🚨 NOTICE: Unrecognized activity detected. Account assets restricted!</div>';</script>",
  },
  {
    id: "usecase-3",
    name: "Use Case 3: Filter Evasion via Event Handlers",
    subtitle: "Bypassing Naive <script> Tag Blocklists",
    description: "When naive developers attempt to filter or blacklist the word '<script>', attackers bypass it using HTML5 inline event handlers (such as <img onerror=...> or <svg onload=...>) that execute without any <script> tag.",
    payload: "<img src='invalid-image' onerror=\"alert('⚠️ Use Case 3 Executed!\\n\\nExecuted via <img> onerror event handler!\\nBypasses filters that only block <script> tags.')\">",
  },
  {
    id: "usecase-4",
    name: "Use Case 4: Attribute Breakout Injection",
    subtitle: "Breaking Out of Quoted HTML Tag Attributes",
    description: "User input is often reflected inside input tags: <input value=\"${query}\">. An attacker uses a double quote (\") to close the value attribute early and inject an event handler (autofocus onfocus=...).",
    payload: '" autofocus onfocus="alert(\'⚡ Use Case 4 Executed!\\n\\nAttribute Breakout: Closed the value attribute using double quotes to inject the onfocus event!\')',
  }
];


// =============================================================================
// =============================================================================
// WEBSITE 1: THE ATTACKER SIDE (PORT 4000)
// =============================================================================
// =============================================================================

const attackerApp = express();
const ATTACKER_PORT = 4000;

// Mobile-friendly script viewer route
attackerApp.get("/script", (_req, res) => {
  res.sendFile(__dirname + "/video_script.html");
});

attackerApp.get("/", (_req, res) => {
  const primaryExploit = USE_CASES[0].payload;
  const vulnLink = `http://localhost:3001/transactions?q=${encodeURIComponent(primaryExploit)}`;
  const safeLink = `http://localhost:3002/transactions?q=${encodeURIComponent(primaryExploit)}`;

  const vectorCards = USE_CASES.map((uc, index) => {
    const vLink = `http://localhost:3001/transactions?q=${encodeURIComponent(uc.payload)}`;
    const sLink = `http://localhost:3002/transactions?q=${encodeURIComponent(uc.payload)}`;

    return `
      <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
          <div>
            <h3 style="color: #38bdf8; font-size: 1.05rem; font-weight: 700;">${escapeHtml(uc.name)}</h3>
            <div style="font-size: 0.8rem; color: #94a3b8; font-style: italic;">${escapeHtml(uc.subtitle)}</div>
          </div>
          <span style="background: #020617; color: #cbd5e1; font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px; font-family: monospace;">Vector #${index + 1}</span>
        </div>
        
        <p style="font-size: 0.85rem; color: #cbd5e1; line-height: 1.5; margin: 0.5rem 0;">${escapeHtml(uc.description)}</p>
        
        <div style="background: #020617; color: #e2e8f0; font-family: monospace; font-size: 0.75rem; padding: 0.6rem; border-radius: 4px; overflow-x: auto; margin: 0.5rem 0; border: 1px solid #334155;">
          ${escapeHtml(uc.payload)}
        </div>

        <div style="display: flex; gap: 0.75rem; margin-top: 0.75rem; flex-wrap: wrap;">
          <a href="${vLink}" target="_blank" onclick="recordClick('Vector #${index + 1} (${uc.name.split(':')[0]})', 'Vulnerable Server (3001)')" style="background: #dc2626; color: white; text-decoration: none; padding: 0.45rem 0.9rem; border-radius: 5px; font-size: 0.8rem; font-weight: 700;">
            ⚡ Trigger on Vulnerable Bank (Port 3001) &rarr;
          </a>
          <a href="${sLink}" target="_blank" onclick="recordClick('Vector #${index + 1} (${uc.name.split(':')[0]})', 'Hardened Server (3002)')" style="background: #16a34a; color: white; text-decoration: none; padding: 0.45rem 0.9rem; border-radius: 5px; font-size: 0.8rem; font-weight: 700;">
            🛡️ Verify Blocked on Hardened Bank (Port 3002) &rarr;
          </a>
        </div>
      </div>
    `;
  }).join("");

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Attacker Command Center & Campaign Telemetry</title>
      <style>
        :root {
          --dark-bg: #0b0f19;
          --dark-surface: #151d30;
          --dark-border: #243049;
          --accent-red: #ef4444;
          --accent-green: #22c55e;
          --accent-cyan: #38bdf8;
          --text: #f8fafc;
          --text-muted: #94a3b8;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: var(--dark-bg); color: var(--text); padding-bottom: 60px; line-height: 1.5; }
        header { background: #020617; border-bottom: 1px solid var(--dark-border); padding: 1.25rem 2rem; display: flex; justify-content: space-between; align-items: center; }
        .badge { background: var(--accent-red); color: white; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em; }
        .container { max-width: 1100px; margin: 2rem auto; padding: 0 1rem; }
        
        .grid-dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
        .stat-card { background: var(--dark-surface); border: 1px solid var(--dark-border); border-radius: 8px; padding: 1.2rem; }
        .stat-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; }
        .stat-value { font-size: 1.25rem; font-weight: 700; color: #f1f5f9; margin-top: 0.35rem; }

        .card { background: var(--dark-surface); border: 1px solid var(--dark-border); border-radius: 10px; padding: 1.5rem; margin-bottom: 1.5rem; }
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--dark-border); }
        .card-title { font-size: 1.15rem; font-weight: 700; color: #f1f5f9; display: flex; align-items: center; gap: 0.5rem; }

        /* Terminal Feed */
        .terminal { background: #020617; border: 1px solid #1e293b; border-radius: 8px; padding: 1rem; font-family: "Courier New", Courier, monospace; font-size: 0.8rem; color: #a7f3d0; max-height: 220px; overflow-y: auto; }
        .log-entry { margin-bottom: 0.4rem; display: flex; gap: 0.75rem; }
        .log-time { color: var(--text-muted); }
        .log-tag-info { color: var(--accent-cyan); font-weight: 700; }
        .log-tag-click { color: #facc15; font-weight: 700; }
        .log-tag-vuln { color: var(--accent-red); font-weight: 700; }
        .log-tag-safe { color: var(--accent-green); font-weight: 700; }

        /* Phishing Email Preview */
        .email-container { background: #ffffff; color: #0f172a; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.4); }
        .email-header { background: #f8fafc; padding: 1rem 1.5rem; border-bottom: 1px solid #e2e8f0; }
        .email-field { font-size: 0.85rem; margin-bottom: 0.25rem; color: #334155; }
        .email-field strong { color: #64748b; display: inline-block; width: 70px; }
        .email-subject { font-size: 1.1rem; font-weight: 800; color: #0f172a; margin-top: 0.5rem; }
        .email-body { padding: 1.5rem; font-size: 0.95rem; line-height: 1.6; }
        .cta-btn { display: inline-block; background: #dc2626; color: white !important; font-weight: 700; text-decoration: none; padding: 0.85rem 1.75rem; border-radius: 6px; margin: 1.25rem 0; box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.4); }
        .cta-btn:hover { background: #b91c1c; }
        .cta-btn-safe { display: inline-block; background: #16a34a; color: white !important; font-weight: 700; text-decoration: none; padding: 0.85rem 1.75rem; border-radius: 6px; margin: 1.25rem 0; }
        .cta-btn-safe:hover { background: #15803d; }
      </style>

      <script>
        function recordClick(vectorName, destination) {
          const feed = document.getElementById("terminal-feed");
          const now = new Date();
          const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
          
          const isSafe = destination.includes("3002");
          const tagClass = isSafe ? "log-tag-safe" : "log-tag-vuln";
          const tagText = isSafe ? "[DEFENSE-BLOCKED]" : "[VICTIM-CLICKED]";
          
          const entry = document.createElement("div");
          entry.className = "log-entry";
          entry.innerHTML = 
            '<span class="log-time">' + timeStr + '</span> ' +
            '<span class="' + tagClass + '">' + tagText + '</span> ' +
            '<span>Victim triggered <strong>' + vectorName + '</strong> &rarr; Target: ' + destination + '</span>';
          
          feed.appendChild(entry);
          feed.scrollTop = feed.scrollHeight;

          const counter = document.getElementById("click-counter");
          if (counter) {
            counter.innerText = parseInt(counter.innerText || "0") + 1;
          }
        }
      </script>
    </head>
    <body>
      <header>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.6rem;">🕵️</span>
          <div>
            <div style="font-size: 1.15rem; font-weight: 700;">Attacker Command Center & Phishing Simulation</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">External Adversary Infrastructure (Port 4000)</div>
          </div>
        </div>
        <span class="badge">SIDE 1: ATTACKER CONSOLE</span>
      </header>

      <div class="container">
        
        <!-- Live Campaign Metrics -->
        <div class="grid-dashboard">
          <div class="stat-card">
            <div class="stat-label">Target Organization</div>
            <div class="stat-value" style="color: var(--accent-cyan);">Apex Trust Bank</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Exploited Endpoint</div>
            <div class="stat-value" style="font-family: monospace; font-size: 1rem;">GET /transactions?q=</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Target Account</div>
            <div class="stat-value">Alex Mercer</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Live Clicks Tracked</div>
            <div id="click-counter" class="stat-value" style="color: #facc15;">0</div>
          </div>
        </div>

        <!-- Live Campaign Telemetry Terminal -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title"><span>📡</span> Live Campaign Activity & Telemetry Feed</h2>
            <span style="font-size: 0.8rem; color: var(--accent-green); font-weight: 600;">● Listener Active</span>
          </div>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.75rem;">
            Watch the console below in real time as the victim interacts with phishing lures or test links:
          </p>
          <div id="terminal-feed" class="terminal">
            <div class="log-entry">
              <span class="log-time">[SYSTEM-INIT]</span>
              <span class="log-tag-info">[CAMPAIGN-READY]</span>
              <span>Reconnaissance complete. Reflection sink confirmed on http://localhost:3001/transactions.</span>
            </div>
            <div class="log-entry">
              <span class="log-time">[SYSTEM-INIT]</span>
              <span class="log-tag-info">[EMAIL-DISPATCH]</span>
              <span>High-urgency fraud alert lure drafted and queued for delivery to alex.mercer@company.com.</span>
            </div>
          </div>
        </div>

        <!-- Simulated Phishing Mailbox -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title"><span>📧</span> Social Engineering Lure: Victim's Mailbox Preview</h2>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Simulated Webmail Client</span>
          </div>
          <p style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 1rem;">
            This is what appears on the victim's screen. The email uses urgency (unauthorized withdrawal alert) to compel the user to click:
          </p>

          <div class="email-container">
            <div class="email-header">
              <div class="email-field"><strong>From:</strong> Apex Fraud Prevention &lt;alerts@apex-trust-security.fake&gt;</div>
              <div class="email-field"><strong>To:</strong> Alex Mercer &lt;alex.mercer@company.com&gt;</div>
              <div class="email-field"><strong>Date:</strong> 03 November 2026 21:30</div>
              <div class="email-subject">⚠️ URGENT: Unrecognized Wire Withdrawal of $1,850.00</div>
            </div>

            <div class="email-body">
              <div style="font-size: 1.1rem; font-weight: 800; color: #1e3a8a; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                <span>🏛️</span> Apex Trust Online Banking — Security Operations
              </div>
              <p>Dear Customer Alex Mercer,</p>
              <br>
              <p>Our automated fraud monitoring algorithms detected an unauthorized wire withdrawal attempt of <strong>$1,850.00</strong> originating from an unrecognized IP address.</p>
              <br>
              <p>If you did not authorize this transaction, review your active transaction ledger immediately and file a dispute:</p>

              <!-- Working Exploit Button -->
              <div style="text-align: center; margin: 1.5rem 0;">
                <a href="${vulnLink}" target="_blank" onclick="recordClick('Primary Lure (Script Alert)', 'Vulnerable Server (3001)')" class="cta-btn">
                  🔍 Click Here to Review Disputed Transaction (Vulnerable Server) &rarr;
                </a>
                <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.5rem;">
                  Directs victim to: <code>http://localhost:3001/transactions?q=&lt;script&gt;...</code>
                </div>
              </div>

              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 1.5rem 0;">

              <!-- Hardened Server Test Button -->
              <p style="font-size: 0.9rem; color: #475569;">
                <strong>Test Implemented Defense:</strong> Send the exact same payload to the <strong>Hardened / Secure</strong> instance (Port 3002):
              </p>
              <div style="text-align: center; margin-top: 0.75rem;">
                <a href="${safeLink}" target="_blank" onclick="recordClick('Primary Lure (Hardened Test)', 'Hardened Server (3002)')" class="cta-btn-safe">
                  🛡️ Click Here to Send Same Payload to Hardened Server (Port 3002) &rarr;
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- 4 Use Cases Showcase Matrix -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title"><span>⚡</span> Exploit Vector Showcase (4 Distinct Use Cases)</h2>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Multiple Reflection Sinks & Manifestations</span>
          </div>
          <p style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 1.25rem;">
            Test each distinct Reflected XSS attack vector below. Notice how clicking any button instantly updates the telemetry feed above:
          </p>
          ${vectorCards}
        </div>

        <!-- Architecture Breakdown -->
        <div class="card" style="border-left: 4px solid var(--accent-cyan);">
          <h3 style="color: var(--accent-cyan); margin-bottom: 0.5rem;">🎓 Key Viva Takeaway: The Client-Side Execution Boundary</h3>
          <p style="font-size: 0.9rem; color: #cbd5e1; line-height: 1.6;">
            Notice what happens when the victim clicks the link: The browser opens a direct TCP connection with <strong>Port 3001 (The Bank)</strong>.
            The payload bounces off the bank's server and executes inside the victim's local browser process.
            The attacker's server (Port 4000) does <strong>not</strong> automatically receive the user's password or screen—this is why Reflected XSS is classified as a <em>client-side reflection vulnerability</em>.
            Defense-in-depth controls like <strong>Content Security Policy (connect-src 'self')</strong> exist specifically to ensure that the injected script can never establish an unauthorized outbound network connection.
          </p>
        </div>

      </div>
    </body>
    </html>
  `);
});


// =============================================================================
// =============================================================================
// WEBSITE 2: THE USER SIDE — APEX TRUST ONLINE BANKING (PORTS 3001 & 3002)
// =============================================================================
// =============================================================================

function renderBankPage({ isSecure, query, filteredTransactions }) {
  const port = isSecure ? 3002 : 3001;
  const instanceBadge = isSecure ? "SECURE INSTANCE (PORT 3002)" : "VULNERABLE INSTANCE (PORT 3001)";
  const badgeColor = isSecure ? "#16a34a" : "#dc2626";

  const rows = filteredTransactions.map(t => `
    <tr>
      <td style="padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; font-size: 0.9rem;">${t.date}</td>
      <td style="padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; font-size: 0.9rem;"><strong>${isSecure ? escapeHtml(t.description) : t.description}</strong></td>
      <td style="padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; font-size: 0.9rem;"><span style="background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: 4px; font-family: monospace;">${isSecure ? escapeHtml(t.category) : t.category}</span></td>
      <td style="padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; font-size: 0.9rem; font-weight: 600; color: ${t.amount.startsWith('+') ? '#16a34a' : '#0f172a'};">${t.amount}</td>
    </tr>
  `).join("");

  let searchBanner = "";
  if (query) {
    if (isSecure) {
      const safeQuery = escapeHtml(query);
      searchBanner = `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 1rem; margin-bottom: 1.5rem; color: #166534;">
          <strong>🔍 Showing transaction results for:</strong> <code>${safeQuery}</code>
          <div style="font-size: 0.8rem; margin-top: 0.25rem; color: #15803d;">
            ✅ MITIGATION ACTIVE: Input passed through escapeHtml(). Tags and quotes converted to entities.
          </div>
        </div>
      `;
    } else {
      searchBanner = `
        <div id="security-banner" style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 1rem; margin-bottom: 1.5rem; color: #991b1b;">
          <strong>🔍 Showing transaction results for:</strong> <strong>${query}</strong>
          <div style="font-size: 0.8rem; margin-top: 0.25rem; color: #b91c1c;">
            ⚠️ VULNERABLE REFLECTION SINK: The server echoed the query string into the HTML response without encoding.
          </div>
        </div>
      `;
    }
  }

  const vectorButtons = USE_CASES.map(uc => {
    const link = `http://localhost:${port}/transactions?q=${encodeURIComponent(uc.payload)}`;
    return `
      <a href="${link}" style="background: ${isSecure ? '#16a34a' : '#dc2626'}; color: white; text-decoration: none; padding: 0.35rem 0.65rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; display: inline-block;">
        ${uc.name.split(':')[0]}
      </a>
    `;
  }).join(" ");

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Apex Trust Online Banking | ${isSecure ? 'Secure' : 'Vulnerable'}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: #f8fafc; color: #0f172a; line-height: 1.5; padding-bottom: 50px; }
        header { background: #172554; color: white; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
        .badge { background: ${badgeColor}; color: white; padding: 0.3rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; }
        .nav { background: white; border-bottom: 1px solid #e2e8f0; padding: 0 2rem; display: flex; gap: 1.5rem; align-items: center; }
        .nav a { padding: 0.85rem 0; text-decoration: none; color: #64748b; font-size: 0.9rem; font-weight: 600; border-bottom: 2px solid transparent; }
        .nav a.active { color: #1e3a8a; border-bottom-color: #1e3a8a; }
        .container { max-width: 1000px; margin: 2rem auto; padding: 0 1rem; }
        .card { background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
        .stat-box { background: #f8fafc; padding: 1rem; border-radius: 6px; border: 1px solid #e2e8f0; }
        .stat-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700; }
        .stat-val { font-size: 1.35rem; font-weight: 700; color: #0f172a; margin-top: 0.25rem; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f8fafc; padding: 0.75rem 1rem; font-size: 0.8rem; font-weight: 700; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; text-align: left; }
      </style>
    </head>
    <body>
      <header>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.5rem;">🏛️</span>
          <div>
            <div style="font-size: 1.15rem; font-weight: 700;">Apex Trust Online Banking</div>
            <div style="font-size: 0.75rem; color: #cbd5e1;">Logged in user: Alex Mercer (Premier Checking)</div>
          </div>
        </div>
        <div>
          <span class="badge">${instanceBadge}</span>
        </div>
      </header>

      <nav class="nav">
        <a href="/" class="active">Account Overview</a>
        <a href="/transactions">Transaction History</a>
        <a href="http://localhost:4000" target="_blank" style="color: #dc2626; margin-left: auto; font-size: 0.85rem;">
          🕵️ Open Attacker Showcase Portal (Port 4000) &rarr;
        </a>
      </nav>

      <div class="container">
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2>Account Overview</h2>
            <span id="account-status" style="font-size: 0.85rem; color: #16a34a; font-weight: 600;">● Active Session</span>
          </div>
          <div class="stat-grid">
            <div class="stat-box">
              <div class="stat-label">Available Balance</div>
              <div id="display-balance" class="stat-val" style="color: #16a34a;">${MOCK_ACCOUNT.balance}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Account Number</div>
              <div class="stat-val">${MOCK_ACCOUNT.accountNumber}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Routing Number</div>
              <div class="stat-val">${MOCK_ACCOUNT.routingNumber}</div>
            </div>
          </div>
        </div>

        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3>Transaction Activity</h3>
            <span style="font-size: 0.85rem; color: #64748b;">${filteredTransactions.length} records</span>
          </div>

          <form action="/transactions" method="GET" style="display: flex; gap: 0.5rem; margin-bottom: 1.25rem;">
            <input type="text" name="q" value="${isSecure ? escapeHtml(query) : query}" placeholder="Search merchant or description..." style="flex: 1; padding: 0.65rem 1rem; border: 1px solid #cbd5e1; border-radius: 6px;">
            <button type="submit" style="background: #1e3a8a; color: white; border: none; padding: 0.65rem 1.25rem; border-radius: 6px; font-weight: 600; cursor: pointer;">Search</button>
          </form>

          ${searchBanner}

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description / Payee</th>
                <th>Category</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="4" style="text-align:center; padding: 1.5rem; color: #64748b;">No matching transactions.</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="card" style="background: #f8fafc;">
          <h4 style="font-size: 0.9rem; color: #475569; margin-bottom: 0.5rem;">Test Exploit Vectors Directly on This Instance:</h4>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${vectorButtons}
          </div>
        </div>

      </div>
    </body>
    </html>
  `;
}


// -----------------------------------------------------------------------------
// VULNERABLE INSTANCE ROUTING (PORT 3001)
// -----------------------------------------------------------------------------
const vulnApp = express();
const VULN_PORT = 3001;

vulnApp.get("/", (_req, res) => {
  res.send(renderBankPage({ isSecure: false, query: "", filteredTransactions: MOCK_TRANSACTIONS }));
});

vulnApp.get("/transactions", (req, res) => {
  const query = req.query.q || "";
  const filtered = query
    ? MOCK_TRANSACTIONS.filter(t => t.description.toLowerCase().includes(query.toLowerCase()) || t.category.toLowerCase().includes(query.toLowerCase()))
    : MOCK_TRANSACTIONS;

  res.send(renderBankPage({ isSecure: false, query, filteredTransactions: filtered }));
});


// -----------------------------------------------------------------------------
// SECURE INSTANCE ROUTING (PORT 3002) - MITIGATION IMPLEMENTED
// -----------------------------------------------------------------------------
const safeApp = express();
const SAFE_PORT = 3002;

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

safeApp.get("/", (_req, res) => {
  res.send(renderBankPage({ isSecure: true, query: "", filteredTransactions: MOCK_TRANSACTIONS }));
});

safeApp.get("/transactions", (req, res) => {
  const query = req.query.q || "";
  const filtered = query
    ? MOCK_TRANSACTIONS.filter(t => t.description.toLowerCase().includes(query.toLowerCase()) || t.category.toLowerCase().includes(query.toLowerCase()))
    : MOCK_TRANSACTIONS;

  res.send(renderBankPage({ isSecure: true, query, filteredTransactions: filtered }));
});


// =============================================================================
// LAUNCH ALL THREE PORTS CONCURRENTLY
// =============================================================================

attackerApp.listen(ATTACKER_PORT, () => {
  console.log("\n" + "=".repeat(78));
  console.log(`  [1] ATTACKER SIDE SERVER RUNNING        ->  http://localhost:${ATTACKER_PORT}`);
  console.log(`      Command Center & Live Telemetry : http://localhost:${ATTACKER_PORT}`);
  console.log("=".repeat(78));
});

vulnApp.listen(VULN_PORT, () => {
  console.log(`  [2] USER SIDE (VULNERABLE BANK) RUNNING ->  http://localhost:${VULN_PORT}`);
  console.log(`      Account Dashboard             : http://localhost:${VULN_PORT}`);
  console.log(`      Transaction Search            : http://localhost:${VULN_PORT}/transactions`);
  console.log("=".repeat(78));
});

safeApp.listen(SAFE_PORT, () => {
  console.log(`  [3] USER SIDE (HARDENED BANK) RUNNING   ->  http://localhost:${SAFE_PORT}`);
  console.log(`      Hardened Account Dashboard    : http://localhost:${SAFE_PORT}`);
  console.log(`      Hardened Search (Escaped)     : http://localhost:${SAFE_PORT}/transactions`);
  console.log("=".repeat(78) + "\n");
});
