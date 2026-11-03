// =============================================================================
//  CYBERSECURITY LAB: REFLECTED CROSS-SITE SCRIPTING (XSS) DEMONSTRATION
//  EXPANDED USE CASES & REFLECTION VECTORS
// =============================================================================
//
//  Course           : Web Server Vulnerabilities & Defense
//  Category         : Cross-Site Scripting (XSS)
//  Variant          : Reflected XSS
//  Instructor       : Dr. Soumyadev Maity
//  Submission Due   : 03 November 2026, 23:59
//
//  Port Architecture:
//    • Port 4000 → ATTACKER SIDE: Phishing Portal & Exploit Vector Showcase
//    • Port 3001 → USER SIDE: Apex Trust Online Banking (Vulnerable Instance)
//    • Port 3002 → USER SIDE: Apex Trust Online Banking (Secured / Hardened Instance)
//
// =============================================================================

const express = require("express");

// -----------------------------------------------------------------------------
// MOCK DATA: SIMULATED BANKING LEDGER
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
    name: "Use Case 1: Standard Element Body Injection",
    subtitle: "Classic Script Tag Execution",
    description: "The payload injects a standard <script> tag into the HTML element body (<div>${query}</div>). Demonstrates that the browser executes arbitrary JavaScript in the application's origin context.",
    payload: "<script>alert('🚨 Use Case 1 Executed!\\n\\nOrigin: ' + document.domain + '\\nStandard script tag parsed in HTML body.')</script>",
  },
  {
    id: "usecase-2",
    name: "Use Case 2: DOM Defacement & Visual Tampering",
    subtitle: "Altering What the User Sees in the UI",
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

attackerApp.get("/", (_req, res) => {
  const cardsHtml = USE_CASES.map((uc, index) => {
    const vulnLink = `http://localhost:3001/transactions?q=${encodeURIComponent(uc.payload)}`;
    const safeLink = `http://localhost:3002/transactions?q=${encodeURIComponent(uc.payload)}`;

    return `
      <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
          <div>
            <h3 style="color: #38bdf8; font-size: 1.05rem; font-weight: 700;">${uc.name}</h3>
            <div style="font-size: 0.8rem; color: #94a3b8; font-style: italic;">${uc.subtitle}</div>
          </div>
          <span style="background: #020617; color: #cbd5e1; font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px; font-family: monospace;">Vector #${index + 1}</span>
        </div>
        
        <p style="font-size: 0.85rem; color: #cbd5e1; line-height: 1.5; margin: 0.5rem 0;">${uc.description}</p>
        
        <div style="background: #020617; color: #e2e8f0; font-family: monospace; font-size: 0.75rem; padding: 0.6rem; border-radius: 4px; overflow-x: auto; margin: 0.5rem 0; border: 1px solid #334155;">
          ${escapeHtml(uc.payload)}
        </div>

        <div style="display: flex; gap: 0.75rem; margin-top: 0.75rem; flex-wrap: wrap;">
          <a href="${vulnLink}" target="_blank" style="background: #dc2626; color: white; text-decoration: none; padding: 0.45rem 0.9rem; border-radius: 5px; font-size: 0.8rem; font-weight: 700;">
            ⚡ Test on Vulnerable Bank (Port 3001) &rarr;
          </a>
          <a href="${safeLink}" target="_blank" style="background: #16a34a; color: white; text-decoration: none; padding: 0.45rem 0.9rem; border-radius: 5px; font-size: 0.8rem; font-weight: 700;">
            🛡️ Verify Blocked on Secure Bank (Port 3002) &rarr;
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
      <title>Attacker Hub: Reflected XSS Use Cases Showcase</title>
      <style>
        :root { --dark-bg: #0f172a; --dark-surface: #1e293b; --red: #ef4444; --green: #22c55e; }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: var(--dark-bg); color: #f8fafc; padding-bottom: 60px; }
        header { background: #020617; border-bottom: 1px solid #334155; padding: 1.25rem 2rem; display: flex; justify-content: space-between; align-items: center; }
        .badge { background: var(--red); color: white; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; }
        .container { max-width: 1050px; margin: 2rem auto; padding: 0 1rem; }
        .card { background: var(--dark-surface); border: 1px solid #334155; border-radius: 10px; padding: 1.5rem; margin-bottom: 1.5rem; }
      </style>
    </head>
    <body>
      <header>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.5rem;">🕵️</span>
          <div>
            <div style="font-size: 1.15rem; font-weight: 700;">Attacker Simulation Portal</div>
            <div style="font-size: 0.75rem; color: #94a3b8;">Reflected XSS Demonstration Suite (Port 4000)</div>
          </div>
        </div>
        <span class="badge">ATTACKER CONTROL CONSOLE</span>
      </header>

      <div class="container">
        <!-- Overview Banner -->
        <div class="card" style="border-left: 4px solid var(--red);">
          <h2 style="font-size: 1.25rem; margin-bottom: 0.5rem; color: #f1f5f9;">
            🎯 Reflected XSS: Multiple Attack Manifestations
          </h2>
          <p style="font-size: 0.9rem; color: #cbd5e1; line-height: 1.6;">
            Reflected XSS is not limited to simple <span style="font-family: monospace; color: #38bdf8;">alert()</span> dialogs. 
            Depending on where untrusted input is reflected (inside HTML text vs. HTML tag attributes) and the attacker's objective, 
            several distinct attack use cases exist. Test each vector below against both the <strong>Vulnerable</strong> and <strong>Secured</strong> banking instances:
          </p>
        </div>

        <!-- Four Use Cases Showcase -->
        <div class="card">
          <h2 style="font-size: 1.15rem; margin-bottom: 1rem; color: #f8fafc; border-bottom: 1px solid #334155; padding-bottom: 0.5rem;">
            Interactive Demonstration Matrix (4 Exploitation Use Cases)
          </h2>
          ${cardsHtml}
        </div>

        <!-- Quick Links -->
        <div style="text-align: center; margin-top: 1.5rem;">
          <a href="http://localhost:3001" target="_blank" style="color: #94a3b8; text-decoration: none; font-size: 0.85rem; margin: 0 1rem;">
            &rarr; Open Vulnerable Bank Dashboard (Port 3001)
          </a>
          <a href="http://localhost:3002" target="_blank" style="color: #94a3b8; text-decoration: none; font-size: 0.85rem; margin: 0 1rem;">
            &rarr; Open Secure Bank Dashboard (Port 3002)
          </a>
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
      // VULNERABLE: Direct unescaped reflection in HTML body!
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

  // Quick use-case test buttons
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
        <!-- Account Overview Card -->
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2>Account Overview</h2>
            <span id="account-status" style="font-size: 0.85rem; color: #16a34a; font-weight: 600;">● Active Session</span>
          </div>
          <div class="stat-grid">
            <div class="stat-box">
              <div class="stat-label">Available Balance</div>
              <!-- Notice ID display-balance used for DOM Defacement demo (Use Case 2) -->
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

        <!-- Transaction Ledger & Search Results -->
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3>Transaction Activity</h3>
            <span style="font-size: 0.85rem; color: #64748b;">${filteredTransactions.length} records</span>
          </div>

          <!-- Note: in vulnerable version, query in input value is also unescaped (attribute breakout context) -->
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

        <!-- In-app Use Cases Switcher -->
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

// The single implemented mitigation: Context-aware HTML entity encoding
function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")   // 1. Must replace ampersands first to prevent double-encoding
    .replace(/</g, "&lt;")    // 2. Disarms opening HTML tags (<script>)
    .replace(/>/g, "&gt;")    // 3. Disarms closing HTML tags
    .replace(/"/g, "&quot;")  // 4. Disarms attribute breakout (double quotes)
    .replace(/'/g, "&#39;");  // 5. Disarms attribute breakout (single quotes)
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
  console.log(`      Exploit Vector Matrix (4 Cases) : http://localhost:${ATTACKER_PORT}`);
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
