/**
 * pi-deepseek-router — task-aware reasoning-mode router + two-phase tool
 * anchoring for DeepSeek-family models on pi.
 *
 * Mechanism (ported from xiaobright/dsh-router-standard and
 * xiaobright/dsh-anchored-standard, both MIT):
 *   1. First user prompt is classified by regex (build → react, fix → spec,
 *      ambiguous → weak) and the system prompt is replaced with the measured
 *      persona for that band (model-aware: Pro vs Flash weak personas).
 *   2. The tool surface is narrowed to the band's core set (RL-shape
 *      bash+edit for weak) until the first successful tool call, then the
 *      full catalog and pi's normal system prompt are restored.
 *   3. Persona/mode stays locked for the session (path commitment).
 *
 * Experimental. Measured gains are DeepSeek V4-specific; on other models
 * this is inert unless you force a mode with /router-mode.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	bandFor,
	classifyReasoning,
	classifyTask,
	coreFor,
	parseMode,
	personaFor,
	type Mode,
} from "./router-core.ts";

type Phase = "idle" | "anchored" | "unlocked";

export default function (pi: ExtensionAPI) {
	let phase: Phase = "idle";
	let fullTools: string[] | null = null;
	let lockedBand: string | null = null;
	let lockedPersona: string | null = null;
	let coreTools: string[] = [];
	let trajectory: string | null = null;
	let sawAssistant = false;
	let override: Mode | null = null; // /router-mode manual mode
	let disabled = false;

	const modelId = (ctx: ExtensionContext) => ctx.model?.id ?? "";

	// DeepSeek models route automatically; anything else needs /router-mode.
	const enabled = (ctx: ExtensionContext) =>
		!disabled && (/deepseek/i.test(modelId(ctx)) || override !== null);

	function anchor(ctx: ExtensionContext, mode: Mode) {
		lockedBand = bandFor(mode);
		lockedPersona = personaFor(mode, modelId(ctx));
		const available = new Set(pi.getAllTools().map((t) => t.name));
		coreTools = coreFor(mode).filter((n) => available.has(n));
		fullTools ??= pi.getActiveTools();
		pi.setActiveTools(coreTools);
		phase = "anchored";
		ctx.ui.setStatus("ds-router", `router: ${lockedBand} (anchored)`);
	}

	pi.on("session_start", async (_event, ctx) => {
		phase = "idle";
		fullTools = null;
		lockedBand = null;
		lockedPersona = null;
		trajectory = null;
		sawAssistant = false;
		if (enabled(ctx)) ctx.ui.setStatus("ds-router", "router: auto");
	});

	pi.on("before_agent_start", async (event, ctx) => {
		if (phase === "unlocked" || !enabled(ctx)) return;
		if (phase === "idle") {
			anchor(ctx, override ?? classifyTask(event.prompt));
		}
		// Still anchored (no durable tool call yet): re-assert minimal surface.
		pi.setActiveTools(coreTools);
		return { systemPrompt: lockedPersona ?? undefined };
	});

	pi.on("tool_execution_end", async (event, ctx) => {
		if (phase !== "anchored" || event.isError) return;
		phase = "unlocked";
		if (fullTools) pi.setActiveTools(fullTools);
		ctx.ui.setStatus("ds-router", `router: ${lockedBand ?? "?"} (unlocked)`);
		ctx.ui.notify("deepseek-router: first tool call landed, full tool catalog restored", "info");
	});

	// Trajectory lexicon check on the first assistant reasoning block
	// (We-need minimal-like vs Let-me standard-like), for /router-status.
	pi.on("message_end", async (event, _ctx) => {
		if (sawAssistant) return;
		const msg = event.message;
		if (msg.role !== "assistant") return;
		sawAssistant = true;
		const reasoning = msg.content
			.filter((c) => c.type === "thinking")
			.map((c) => ("thinking" in c && typeof c.thinking === "string" ? c.thinking : ""))
			.join("\n");
		if (reasoning) trajectory = classifyReasoning(reasoning).label;
	});

	pi.registerCommand("router-mode", {
		description: "Set routing mode: auto | spec | react | weak | mixed | 0-100 | off",
		handler: async (args, ctx) => {
			const token = args.trim();
			if (token === "off") {
				disabled = true;
				if (phase === "anchored" && fullTools) pi.setActiveTools(fullTools);
				phase = "unlocked";
				ctx.ui.setStatus("ds-router", "");
				ctx.ui.notify("deepseek-router disabled", "info");
				return;
			}
			const parsed = parseMode(token);
			if (parsed === null) {
				ctx.ui.notify("usage: /router-mode auto|spec|react|weak|mixed|0-100|off", "error");
				return;
			}
			disabled = false;
			override = parsed === "auto" ? null : parsed;
			ctx.ui.notify(
				phase === "idle"
					? `router mode: ${token} (applies to first prompt)`
					: `router mode: ${token} (persona locked this session; applies to next session)`,
				"info",
			);
		},
	});

	pi.registerCommand("router-status", {
		description: "Show deepseek-router state",
		handler: async (_args, ctx) => {
			ctx.ui.notify(
				`model=${modelId(ctx) || "?"} mode=${override ?? "auto"} band=${lockedBand ?? "-"} phase=${phase} trajectory=${trajectory ?? "-"} tools=${phase === "anchored" ? coreTools.join(",") : "full"}`,
				"info",
			);
		},
	});
}
