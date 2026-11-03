# Reflected XSS: Full Two-Sided Attack Simulation & Defense

**Course:** Web Server Vulnerabilities & Defense  
**Instructor:** Dr. Soumyadev Maity  
**Category:** Cross-Site Scripting (XSS)  
**Variant:** Reflected XSS  
**Context:** Apex Trust Internet Banking vs. Attacker Phishing Campaign  
**Deadline:** 03 November 2026 (Tuesday), 23:59  

---

## 1. Ownership Declaration (Table 3)

| Member Name | Roll Number | Category | Variant Implemented |
|---|---|---|---|
| Tushar Saharan | IIT2024127 | Cross-Site Scripting (XSS) | Reflected XSS |

---

## 2. Architecture: Attacker Side vs. User Side

This lab implements an end-to-end two-sided architecture:

| Site | Port | Role | Description |
|---|---|---|---|
| **Attacker Website** | **4000** | External Attacker / Lure | Simulates the attacker's phishing delivery platform and the victim's email inbox containing the crafted exploit link. |
| **User Website (Vulnerable)** | **3001** | Apex Trust Online Banking | The real banking application containing the unencoded reflection flaw in the transaction search. |
| **User Website (Secured)** | **3002** | Apex Trust Online Banking (Hardened) | The exact same banking application, but protected with context-aware HTML entity encoding (`escapeHtml()`). |

---

## 3. How to Run with a Single Command

```bash
# 1. Install dependencies (if not already installed)
npm install

# 2. Run all three servers concurrently
npm run dev
```

### URLs to Open:
1. **Attacker Side (Start Here):** [http://localhost:4000](http://localhost:4000)
2. **User Side - Vulnerable Bank:** [http://localhost:3001](http://localhost:3001)
3. **User Side - Secured Bank:** [http://localhost:3002](http://localhost:3002)

---

## 4. The 4 Reflected XSS Use Cases Implemented

The application demonstrates four distinct manifestations and reflection contexts of Reflected XSS:

### Use Case 1: Standard Script Tag Execution (Brief Baseline)
- **Vector:** `<script>alert('🚨 XSS EXECUTED! Origin: ' + document.domain)</script>`
- **Mechanism:** Injected directly into the HTML body text (`<div>${query}</div>`).
- **Observed Behavior:** An alert dialog pops up immediately displaying the bank's security origin (`localhost:3001`), confirming arbitrary JavaScript execution inside the active session.

### Use Case 2: DOM Defacement & Visual State Tampering (No Alert Dialog)
- **Vector:** `<script>document.getElementById('display-balance').innerText='$0.00'; document.getElementById('account-status').innerHTML='⚠️ FROZEN';</script>`
- **Mechanism:** Injected as inline script that programmatically alters Document Object Model (DOM) nodes instead of calling `alert()`.
- **Observed Behavior:** **No popup appears.** Instead, the victim's displayed account balance is dynamically rewritten from **`$14,820.50` &rarr; `$0.00`** and the session status changes to a red **`⚠️ FROZEN (UNDER INVESTIGATION)`** banner.
- **Significance:** Proves that XSS can silently manipulate page content to deceive users or induce panic without triggering loud popup alerts.

### Use Case 3: Filter Evasion via Inline Event Handlers
- **Vector:** `<img src='invalid-image' onerror="alert('Executed via onerror event handler!')">`
- **Mechanism:** Utilizes HTML5 inline event handlers inside non-script tags.
- **Observed Behavior:** When the browser fails to load the invalid image resource, the `onerror` event handler fires, executing JavaScript without using the `<script>` keyword.
- **Significance:** Demonstrates how attackers bypass naive blacklists that merely strip or filter the word `<script>`.

### Use Case 4: Attribute Breakout Injection
- **Vector:** `" autofocus onfocus="alert('Attribute Breakout!')`
- **Mechanism:** User input is reflected inside an HTML tag attribute: `<input name="q" value="${query}">`. The leading double quote (`"`) prematurely closes the `value` attribute, allowing the attacker to inject new attributes and event handlers.
- **Observed Behavior:** The input field automatically gains focus on page load, immediately triggering the injected `onfocus` event handler.
- **Significance:** Proves why output encoding must handle quotes (`"` and `'`), not just angle brackets (`<` and `>`).

---

## 5. Assessment Deliverables (Table 2 Requirements)

### (a) Vulnerable Implementation
- **File:** `app.js` (Route `GET /transactions` on Port 3001)
- **Flawed Code:**
  ```javascript
  const query = req.query.q || "";
  // Unsanitized query string interpolated directly into response HTML string
  searchBanner = `Showing transaction results for: <strong>${query}</strong>`;
  ```

### (b) Working Exploit
- **Exact Payload:**
  ```html
  <script>alert('🚨 XSS EXECUTED!\n\nOrigin: ' + document.domain + '\nVictim Active Session: Authenticated\nArbitrary JavaScript is running inside the bank!')</script>
  ```
- **Delivered URL (from Port 4000):**
  ```
  http://localhost:3001/transactions?q=%3Cscript%3Ealert('...')%3C/script%3E
  ```

### (c) Root Cause
The web server reflects untrusted input directly from `req.query.q` into the HTML document structure without context-aware output encoding or sanitization. The browser cannot distinguish application markup from attacker input and executes the injected script inside the authenticated banking origin.

### (d) Implemented Mitigation (Port 3002)
- **Technique:** Context-Aware HTML Entity Encoding.
- **Code:**
  ```javascript
  function escapeHtml(str) {
    if (typeof str !== "string") return "";
    return str
      .replace(/&/g, "&amp;")   // 1. Must replace ampersands first to prevent double-encoding
      .replace(/</g, "&lt;")    // 2. Disarms opening HTML tags (<script>)
      .replace(/>/g, "&gt;")    // 3. Disarms closing HTML tags
      .replace(/"/g, "&quot;")  // 4. Disarms attribute breakout (double quotes)
      .replace(/'/g, "&#39;");  // 5. Disarms attribute breakout (single quotes)
  }

  // Applied before interpolation:
  const safeQuery = escapeHtml(query);
  searchBanner = `Showing transaction results for: <code>${safeQuery}</code>`;
  ```
- **Verification:** Submitting the identical exploit link to Port 3002 renders the payload as plain text on the page with zero script execution.

### (e) Other Mitigations (Theory from Lecture Slides)
1. **Framework Auto-Escaping:** Templating engines (React JSX, Handlebars `{{}}`, EJS `<%= %>`) encode variables by default unless explicitly bypassed.
2. **HTML Sanitizers:** For formatted user inputs, libraries like DOMPurify parse and strip malicious HTML nodes (`<script>`, `<iframe>`, event handlers) while allowing safe formatting (`<b>`, `<i>`).
3. **Content Security Policy (CSP):** The HTTP header `Content-Security-Policy: default-src 'self'; script-src 'self'` restricts executable script origins and blocks inline scripts.
4. **HttpOnly Flag on Cookies:** `Set-Cookie: session=xyz; HttpOnly` prevents JavaScript access via `document.cookie`, mitigating credential/session hijacking.
5. **Safe DOM Sinks:** Using `element.textContent` instead of `element.innerHTML` on the client side ensures dynamic content is never interpreted as executable HTML.
