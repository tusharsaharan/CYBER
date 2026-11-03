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
| *(Your Full Name)* | *(Your Roll No)* | Cross-Site Scripting (XSS) | Reflected XSS |

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

## 4. End-to-End Execution Flow (What to Show in Video / Viva)

```
+---------------------------------------------------------------------------------------------------------+
|                                        END-TO-END ATTACK FLOW                                           |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|  [STEP 1: ATTACKER SIDE - PORT 4000]                                                                    |
|  • Attacker identifies the transaction search flaw: http://localhost:3001/transactions?q=...            |
|  • Attacker crafts a phishing email to user Alex Mercer:                                                |
|    "Urgent: Unrecognized Wire Withdrawal of $1,850.00 detected on your account!"                        |
|  • Attacker embeds the payload into the action button:                                                  |
|    href="http://localhost:3001/transactions?q=<script>alert('...')</script>"                           |
|                                         │                                                               |
|                                         ▼ (User clicks the button inside their email)                   |
|                                                                                                         |
|  [STEP 2: USER SIDE - PORT 3001 (VULNERABLE BANK)]                                                      |
|  • User's browser navigates to the bank website.                                                        |
|  • User is logged in (Account Balance: $14,820.50).                                                     |
|  • Bank server reflects raw query string into HTML without escaping:                                    |
|    <div>Showing transaction results for: <strong>${query}</strong></div>                               |
|  • RESULT: User's browser executes the script inside the bank's security origin (alert pops up).       |
|                                                                                                         |
|  [STEP 3: USER SIDE - PORT 3002 (SECURE BANK MITIGATION)]                                               |
|  • User clicks the secure comparison link in the phishing email.                                        |
|  • Secure server runs escapeHtml(query) converting < and > to &lt; and &gt;.                            |
|  • RESULT: Script is rendered as inert, harmless text. NO alert fires. Mitigation verified!            |
+---------------------------------------------------------------------------------------------------------+
```

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
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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
