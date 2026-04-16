# Claude Code Smart Optimizer (CCSO) v3.0.0

> **A smart middleware layer between you and your AI tools — silently saves tokens, routes to cheaper models, and works across every platform.**

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/vubemodo)

Instead of typing `claude`, type `ccso` — and all the savings happen automatically in the background.

Works with: **Claude Code · Cursor · Windsurf · VS Code + Copilot · Gemini Code Assist · Firebase Studio · Android Studio · Codex CLI**

---

## What it does

| Feature | Description | Estimated Saving |
|---|---|---|
| **Smart model routing** | Simple questions → Haiku (10× cheaper), complex → Opus | up to 90% on simple queries |
| **Response cache** | Same prompt → cached response, zero API calls | 100% on repeated prompts |
| **Code compression** | Strips comments, console.log, blank lines from code blocks | 15–35% per code block |
| **Log trimming** | Long logs → last 50 lines only | up to 90% on logs |
| **Large file truncation** | Files >300 lines → smart head+tail | up to 60% |
| **Deduplication** | Repeated lines removed from prompt | up to 20% |
| **Politeness stripping** | Removes "please", "thank you", "could you" | ~5% per prompt |
| **Response length hints** | Short questions get a brevity instruction | saves output tokens |
| **Auto Git context** | Injects `git status` + diff when debugging | fewer back-and-forth |
| **Secret scanner** | Warns before you leak API keys | security |
| **Path resolver** | "fix auth.ts" → `/src/pages/auth.ts` | saves search |
| **Auto Handoff** | When session cost hits threshold — summarizes and resets | 30–50% per session |
| **inject command** | Applies savings rules to Cursor, VS Code, Gemini, Firebase | savings on every tool |
| **Browser dashboard** | Live stats, charts, platform detection, chat | full visibility |

---

## Quick start

```bash
git clone https://github.com/igal2004/claude-smart-optimizer.git
cd claude-smart-optimizer
node bin/install.js
```

Open a new terminal and run:

```bash
ccso
```

---

## Platform support

Use `ccso inject` inside any project to apply savings rules to all platforms at once.

Creates these files automatically:
- `CLAUDE.md` — Claude Code
- `.cursorrules` — Cursor
- `.windsurfrules` — Windsurf
- `.github/copilot-instructions.md` — VS Code + Copilot
- `.ccso_instruction` — Gemini Code Assist
- `.idx/dev.nix` — Firebase Studio / Project IDX

---

## Dashboard

```bash
node src/dashboard/server.js
# open http://localhost:3847
```

---

## REPL commands

```
/handoff        — save session summary and reset
/status         — show current session cost and stats
/cache          — show number of cached responses
/cache clear    — clear response cache
/dashboard      — open dashboard in browser
/history        — show prompt history
/exit           — quit
```

---

## Configuration

Edit via `ccso --config` or directly in `~/.config/claude-smart-optimizer/config.json`:

| Setting | Default | Description |
|---|---|---|
| `backend` | `claude` | `claude` or `codex` |
| `translate` | `true` | Auto-translate Hebrew → English |
| `stripPoliteness` | `true` | Remove filler words |
| `resolvePaths` | `true` | Resolve relative paths |
| `trimLogs` | `true` | Trim logs to 50 lines |
| `codeCompression` | `true` | Compress code blocks |
| `secretScanner` | `true` | Scan for API keys |
| `gitContext` | `true` | Inject Git context |
| `smartRouting` | `true` | Smart model routing |
| `promptCache` | `true` | Response cache (24h) |
| `cacheTTLHours` | `24` | Cache TTL in hours |
| `timeGuard` | `true` | Peak hours warning |
| `costThreshold` | `0.80` | Auto-handoff cost threshold (USD) |
| `commandThreshold` | `25` | Auto-handoff command count |

---

## Run tests

```bash
node tests/test.js
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get involved. All features on the [ROADMAP](ROADMAP.md) are open for contribution.

---

## Uninstall

```bash
ccso --uninstall
```

Claude Code continues to work normally with the `claude` command.

---

## License

MIT — free for personal and commercial use.
