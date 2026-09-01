# pi-deepseek-router

[中文](README.md)

Task-aware reasoning-mode router + two-phase tool anchoring for DeepSeek-family models on pi. The mechanism is ported from [yjh051108/dsh-router-standard](https://github.com/yjh051108/dsh-router-standard) and [xiaobright/dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard) (both MIT; the trajectory lexicon classifier is ported from xiaobright/modeltest trigger_probe, MIT, whose experiment tooling now lives in the DeepseekCotexplorations research repo).

**Experimental.** The upstream score gains were measured only on DeepSeek V4 Pro/Flash, and the theoretical explanation was formally retracted by its author (the engineering gains stand). On other models this extension stays inert unless you force a mode with `/router-mode`. Not affiliated with or endorsed by DeepSeek; "DeepSeek" is a trademark of its respective owner.

## How It Works

1. The first user prompt of a session is classified by regex: **build-flavored → react mode** (think-act loops), **fix-flavored → spec mode** (plan-first), **ambiguous → weak mode** (model self-routes; persona auto-selected for Pro vs Flash).
2. The system prompt is replaced with the measured persona for that band, and the tool surface is narrowed to the band's core set (weak gets the RL-shape `bash`+`edit` surface).
3. Once the first tool call lands successfully, the full tool catalog and pi's normal system prompt are restored.
4. Persona/mode stays locked for the session (path commitment) — switching mid-session does not apply.

## Install (git package, no npm publish needed)

```bash
# Install
pi install git:github.com/aethel-tail/pi-deepseek-router

# Pin a version (recommended, uses git tags)
pi install git:github.com/aethel-tail/pi-deepseek-router@v0.1.0

# Try without installing
pi -e git:github.com/aethel-tail/pi-deepseek-router

# Update / remove
pi update git:github.com/aethel-tail/pi-deepseek-router
pi remove git:github.com/aethel-tail/pi-deepseek-router
```

For local development, copy this directory to `~/.pi/agent/extensions/pi-deepseek-router/` and it loads automatically.

## Commands

| Command | Effect |
|---|---|
| `/router-status` | Current model / mode / phase (anchored·unlocked) / first-reasoning trajectory class |
| `/router-mode auto` | Restore automatic classification (default) |
| `/router-mode spec\|react\|weak\|mixed\|0-100` | Force a mode (locked per session; applies to the next session) |
| `/router-mode off` | Disable entirely and restore tools |

## Development

```bash
npm install        # devDependencies (pi types + typescript)
npm test           # node --test (Node 24 runs .ts natively)
npm run typecheck  # tsc --noEmit (strict, no any)
```

## Files

- `index.ts` — pi extension entry (events + commands)
- `router-core.ts` — zero-dependency routing logic and regexes (unit-testable)
- `router-core.test.ts` — self-check tests

## License

MIT (see [LICENSE](./LICENSE), includes the upstream xiaobright copyright line). Derivative attribution is also kept in each source file's header comment.

## Acknowledgments

Developed and maintained by aethel-tail with KIMI K3 (Moonshot AI). Routing logic, personas, and the trajectory classifier are ported from xiaobright's DSH research projects (MIT).
