# CLAUDE.md — Simplifi Project

**Last Updated:** 2026-04-18\
**Scope:** Simplifi (SA employment equity compliance automation)\
**Hierarchy:** Project-level (this file) → Global \~/.claude/CLAUDE-consolidated.md (inherits defaults)

---

## Project Context

**Role:** Architect of developer instructions, multi-agentic orchestration, and automation systems.

**Primary Scope:**

- Simplifi: C:\Users\Rivaan\Dev\Simplifi
- Employment Equity Act (EEA) compliance automation for SA SME clients
- Sector-specific numerical targets (GN 6124, 2025–2029)
- Penalty exposure: R1.5M–R2.7M or 2–10% of annual turnover

**Platforms:** Windows 11, Git, Node.js, Python, TypeScript, Bash

**Compliance Framework:** EEA 55/1998 + GN 6124 gazette notice (2025)

---

## Project-Specific Rules

### Compliance-First Decision Making

- High-stakes EEA decisions default to **Opus 4.7** (not Sonnet)
- Penalty exposure and legal risk override convenience/speed
- All code touching compliance workflows requires compliance-pattern reference check

### Security & Secrets (Enhanced)

**Sensitive Data Handling:**

- Simplifi processes sensitive employment data (race, gender, disability, salary, citizenship)
- Never log raw sensitive data; sanitize before any output
- All APIs accessing employee data must validate `.env` secrets before startup
- Compliance certificate management (s53) requires audit trail

**Secrets & Environment Variables:**

- Never in source; only in `.env` (local, never committed)
- Access via single config module (never scattered as `process.env.X` inline)
- Validate `.gitignore` includes `.env*` before first commit
- If leaked: remove from source + rotate credential immediately
- `.env.example`: placeholder format only, never real values

**Input Validation:**

- Validate ALL external input at system boundaries (HTTP bodies, query params, file uploads, CLI args, webhook payloads)
- Use explicit schema validation (Zod, Joi, etc.), never rely on type coercion
- Reject invalid input early with structured error response
- Log rejection without echoing raw input if it may contain PII or employment data

**File Path Sanitization:**

- Never construct paths by concatenating raw user input
- Resolve to absolute canonical form before use
- Assert resolved path is within permitted base directory
- Reject paths containing `..`, null bytes (`\0`), URL-encoded traversal (`%2e%2e`)
- Implement in shared utility; never inline or duplicate

**Principle of Least Privilege:**

- Code accesses only what it needs
- Validate at trust boundaries (external data); trust internal code
- No backdoors, feature flags, or compatibility shims when you can just change the code

---

## Next Steps (Continue from Global CLAUDE.md)

All other rules default to global CLAUDE.md unless explicitly overridden above.
