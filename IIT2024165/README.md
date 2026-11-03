# SQL Injection: Authentication Bypass

## Assignment submission

| Field | Details |
|---|---|
| Student name | Shivam Kumar |
| Roll number | IIT2024165 |
| Instructor | Dr. Soumyadev Maity |
| Category | SQL Injection |
| Variant | 1 — Authentication Bypass |

## Project overview

This project is a controlled, localhost-only demonstration of SQL injection in an authentication workflow. It uses an in-memory SQLite database and fictional account data only. Its purpose is to compare a deliberately vulnerable login handler with the same login flow protected by a parameterized query.

## Two-sided architecture

One command starts three local web services simultaneously. These form the required attacker and target sides of the demonstration.

| Side | Component | URL | Responsibility |
|---|---|---|---|
| Attacker side | Attacker Command Center | `http://localhost:4000` | Shows reconnaissance, selected parameter, payload, local delivery controls, and live telemetry. |
| Target side | Vulnerable Meridian Portal | `http://localhost:3001` | Contains the intentionally unsafe login query and demonstrates authentication bypass. |
| Target side | Hardened Meridian Portal | `http://localhost:3002` | Provides the identical portal with the mitigation enabled and rejects the same payload. |

The attacker console sends a local `POST /login` request to either target. This makes the result directly comparable: the payload succeeds on port 3001 and fails on port 3002.

## Setup and execution

**Prerequisite:** Node.js 18 or later.

```bash
npm install
npm run dev
```

After startup, open the three URLs listed above.

## Rubric documentation

### (a) Vulnerable implementation

The vulnerable endpoint is `POST /login` in `app.js`, in the `kind === 'vulnerable'` branch of `createTarget()`. It is explicitly marked with the comment `VULNERABILITY (Rubric a)`.

```js
const insecureSql = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}' LIMIT 1`;
```

This statement concatenates submitted username and password values directly into SQL text.

### (b) Working exploit

The attacker command center submits the following request to `http://localhost:3001/login`:

```text
username = ' OR '1'='1' -- 
password = not-the-password
```

The effective vulnerable query is:

```sql
SELECT * FROM users WHERE username = '' OR '1'='1' -- ' AND password = 'not-the-password' LIMIT 1
```

The Boolean expression is true and the trailing SQLite comment removes the password comparison. The vulnerable portal therefore opens a fictional user dashboard.

### (c) Root cause

The root cause is unparameterized string concatenation: attacker-controlled input is placed inside the SQL command itself. The database interprets the injected characters as SQL syntax rather than treating the complete value as username data.

### (d) Mitigation implemented

Port 3002 implements exactly one active mitigation: a parameterized query using positional placeholders.

```js
db.prepare('SELECT * FROM users WHERE username = ? AND password = ? LIMIT 1').get(username, password);
```

Bound parameters preserve the submitted value as data. The identical payload is therefore a nonexistent username and returns a generic sign-in failure on port 3002.

### (e) Other mitigations from lecture theory

Parameterized queries are the primary defense because they separate SQL code from data. Allow-list validation can additionally constrain a username to an expected character set and length. Least-privilege database credentials reduce the impact if a flaw remains, and safe generic error messages prevent disclosure of SQL syntax, table names, or database details. These measures are complementary; none replaces parameterized queries.

## Project files

| File | Purpose |
|---|---|
| `package.json` | Dependencies and `npm run dev` startup script. |
| `app.js` | Attacker and target services, mock database, UI, vulnerability, and defense. |
| `README.md` | Formal submission documentation. |
