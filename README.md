# Claude Code Smart Optimizer (CCSO) v3.0.0

> Conservative prompt optimization for Claude Code, with transparent savings metrics and honest platform support.

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/vubemodo)

CCSO works best when it is the process that actually sends the prompt. That is why the strongest support is for Claude Code itself, while IDE integrations such as Cursor, Windsurf, Copilot, and Gemini are presented as assisted integrations or instruction targets rather than full runtime backends.

## What CCSO actually does

| Area | What happens | Notes |
|---|---|---|
| Smart routing | Simple prompts can go to Haiku, complex ones to Opus | enabled by default |
| Conservative cache | Repeated prompts can reuse prior answers | measured and shown in the dashboard |
| Focused log trimming | Large noisy logs are reduced to the useful error window | enabled by default |
| Relevance-scoped memory | Small, relevant project facts are injected under a token budget | enabled by default |
| Optional lossy features | Translate, code compression, dedupe, truncation, output hints | off by default for safety |
| Dashboard | Live stats, savings breakdown, platform support, dashboard chat | savings are shown only where CCSO can truly measure them |

## Platform support

CCSO does not claim the same support level everywhere.

| Platform | Support level | What works | What does not |
|---|---|---|---|
| Claude Code | Full backend | prompt execution, routing, cache, memory, measured spend/savings, dashboard chat, MCP/project files | only prompts sent through CCSO are measured |
| Cursor | Project rules + MCP | `.cursorrules`, MCP config, helper flows | no prompt interception, no usage measurement |
| Windsurf | Project rules + MCP | `.windsurfrules`, MCP config | no prompt interception, no usage measurement |
| GitHub Copilot | Instruction file only | `.github/copilot-instructions.md` generation | no runtime control or stats |
| Gemini Code Assist | Instruction file only | `.ccso_instruction` generation | no runtime control or stats |
| Firebase Studio / Project IDX | Project config only | `.idx/dev.nix` scaffold plus Gemini instruction text | no runtime control or stats |
| NotebookLM Bridge | Companion utility | `ccso notebooklm ...` commands | not an inline coding backend |

## What the dashboard means

The dashboard is intentionally strict:

- `Spend` is measured only for prompts that CCSO itself sends.
- `Net savings` is an estimate based on prompt reduction, cache hits, routing impact, and shorter outputs.
- IDE-only tools such as Cursor, Windsurf, and Copilot are not counted in spend or savings.
- The dashboard distinguishes between `Measured`, `Estimated`, and `Not measured` support paths.

Start it with:

```bash
ccso --dashboard
```

Or, on macOS, you can double-click:

```bash
./הפעל\ CCSO.command
```

Default local URL:

```text
http://localhost:3847
```

## Quick start

```bash
git clone https://github.com/igal2004/claude-smart-optimizer.git
cd claude-smart-optimizer
npm install
node bin/install.js
```

Open a new terminal, then run:

```bash
ccso
```

## Main commands

```text
ccso                     start the Smart REPL
ccso --init              create project files such as CLAUDE.md
ccso --dashboard         open the browser dashboard
ccso --config            edit settings
ccso --status            show current status
ccso --uninstall         remove CCSO
ccso inject              write supported project/instruction files
ccso mcp list            list MCP integrations
ccso notebooklm list     list NotebookLM notebooks
```

Inside the REPL:

```text
/status
/handoff
/cache
/cache clear
/history
/memory
/template
/dashboard
/exit
```

## Configuration defaults

CCSO now ships with conservative defaults. Lossy features stay off until you explicitly enable them.

| Setting | Default |
|---|---|
| `backend` | `claude` |
| `translate` | `false` |
| `codeCompression` | `false` |
| `truncateLargePastes` | `false` |
| `dedupeLongInput` | `false` |
| `responseLengthHints` | `false` |
| `stripPoliteness` | `true` |
| `resolvePaths` | `true` |
| `trimLogs` | `true` |
| `secretScanner` | `true` |
| `gitContext` | `true` |
| `smartRouting` | `true` |
| `promptCache` | `true` |
| `memoryEnabled` | `true` |
| `memoryTokenBudget` | `180` |
| `memoryMaxFacts` | `6` |

Open the interactive settings screen with:

```bash
ccso --config
```

## Testing

```bash
npm test
```

## Uninstall

```bash
ccso --uninstall
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
