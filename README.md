# Web Server Security Assignment

**Course:** Cyber Security (IT-30001), Autumn Semester 2026, IIIT Allahabad  
**Instructor:** Dr. Soumyadev Maity  
**Repository:** https://github.com/tusharsaharan/CYBER

Each member implemented one vulnerability variant in a fictional, localhost-only lab. Every variant has a vulnerable instance, a working exploit, and a hardened instance that blocks the same payload.

## Table 3. Ownership Declaration

| Member name | Roll number | Category | Variant implemented |
|---|---|---|---|
| Shivam Kumar | IIT2024165 | SQL Injection | Authentication Bypass |
| Tushar Saharan | IIT2024127 | Cross-Site Scripting (XSS) | Reflected XSS |
| Rakesh | IIT2024149 | OS Command Injection | In-band (output returned) |
| Lakshya | IIT2024212 | CSRF | GET-based forged action |
| Sahil Gupta | IIT2024123 | Cross-Site Scripting (XSS) | Stored XSS |

## Overview of all variants

| Variant | Project | Vulnerable | Hardened | Fix implemented |
|---|---|---:|---:|---|
| SQLi Auth Bypass | Mock banking login | `:3001` | `:3002` | Parameterized queries |
| Reflected XSS | Apex Trust Online Banking | `:3001` | `:3002` | HTML entity encoding (`escapeHtml()`) |
| In-band OS Command Injection | NetDiag Pro | `:3001` | `:3002` | `execFile()` + allow-list regex |
| GET-based CSRF | ApexTrust NetBanking | `:3001` | `:3002` | POST + CSRF token + SameSite |
| Stored XSS | Campus Voice | `:8000` | `:8001` | `html.escape(body, quote=True)` |

The Node.js labs also run an attacker console on `:4000` that delivers the test request and shows telemetry.

## Vulnerability variants

### 1. SQL Injection: Authentication Bypass (Shivam Kumar)

- **Flaw:** `POST /login` builds SQL by inserting form fields directly into the query (`app.js`, line 90).
- **Exploit:** `username ' OR '1'='1' --` with any password. The always-true condition and SQL comment skip the password check; `LIMIT 1` returns the admin row.
- **Root cause:** User input is concatenated into the SQL string.
- **Mitigation implemented:** Parameterized queries with placeholders on `:3002` (`app.js`, line 95). The same input fails.
- **Other mitigations:** Allow-list validation, a least-privilege database account, safe/generic errors, and salted password hashes.

### 2. Reflected XSS (Tushar Saharan)

- **Flaw:** `GET /transactions?q=` echoes the query into the page unencoded (`app.js`, line 397).
- **Exploit:** `<script>alert(origin)</script>`; also `<img src=x onerror=...>` (filter evasion), attribute breakout, and DOM defacement (balance shown as `$0.00`).
- **Root cause:** Untrusted input is placed into the HTML response without output encoding.
- **Mitigation implemented:** Context-aware HTML entity encoding with `escapeHtml()` (line 25). The payload renders as inert text on `:3002`.
- **Other mitigations:** Framework auto-escaping, a sanitizer such as DOMPurify, Content Security Policy, and `HttpOnly` cookies.

### 3. OS Command Injection: In-band (Rakesh)

- **Flaw:** `GET /api/ping?host=` runs `ping -c 1 ${host}` through `child_process.exec()`.
- **Exploit:** `10.0.0.1; whoami` (Windows: `10.0.0.1 & whoami`). The username appears in the JSON response, so the injection is in-band.
- **Root cause:** `exec()` starts a shell that treats `;`, `&`, `&&`, and `|` as command separators.
- **Mitigation implemented:** `execFile('ping', [args])` with no shell, plus an allow-list regex `/^[a-zA-Z0-9.-]+$/` that returns HTTP 400 for illegal input.
- **Other mitigations:** Avoid the shell, use library APIs, and run with least privilege.

### 4. CSRF: GET-based forged action (Lakshya)

- **Flaw:** `GET /api/transfer?recipient=&amount=` changes state using only the session cookie (`app.js`, line 255).
- **Exploit:** An attacker page on `:4000` embeds `<img src="http://localhost:3001/api/transfer?recipient=mallory&amount=1500">`. The victim’s browser sends the cookie automatically and `$1,500` moves to Mallory.
- **Root cause:** A state-changing request is accepted without a token or any proof of user intent.
- **Mitigation implemented:** GET transfers return HTTP 405; transfers use POST with a synchronizer CSRF token and `SameSite=Lax` cookies (`app.js`, line 395).
- **Other mitigations:** Re-authentication (password/OTP), `Origin`/`Referer` verification, and never using GET for state changes.

### 5. Stored XSS (Sahil Gupta)

- **Flaw:** Feedback is saved in SQLite and `render_comment_body()` returns it unchanged into the HTML on `:8000`.
- **Exploit:** Submit `<script>alert('Stored XSS executed')</script>` as a message. It runs on every page load because it stays in the database.
- **Root cause:** Stored attacker input is rendered into HTML without output encoding.
- **Mitigation implemented:** `html.escape(body, quote=True)` on `:8001`, so the same record shows as plain text.
- **Other mitigations:** Framework auto-escaping, an HTML sanitizer, Content Security Policy, `HttpOnly` cookies, and safe DOM sinks such as `textContent`.

## How to run

### Node.js labs (Shivam, Tushar, Rakesh, Lakshya)

```bash
npm install
npm run dev     # starts :4000 attacker, :3001 vulnerable, :3002 hardened
```

### Stored XSS lab (Sahil)

```bash
python app.py   # starts :8000 vulnerable and :8001 mitigated
python -m unittest -v   # run tests
```

To reset the Stored XSS demo, delete `guestbook.sqlite3` and start the app again.

## Scope and integrity

All accounts, balances, and data are fictional. Everything runs on localhost for an authorized teaching lab and must not be used against real targets. Each member owns exactly one variant and will demonstrate it individually at the viva.
