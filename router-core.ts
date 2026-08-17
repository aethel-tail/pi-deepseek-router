/**
 * router-core: reasoning-mode routing logic for pi (zero dependencies).
 *
 * Derived from xiaobright/dsh-router-standard preset/router-standard/router-core.mjs (MIT)
 * and xiaobright/modeltest evaluator/trigger_probe/src/classifier.mjs (MIT).
 * Behavior notes (measured on DeepSeek V4 Pro/Flash by the upstream authors):
 * behavior along the react<->spec axis collapses into three stable regions
 * (spec / unstable transition / react); ambiguous tasks route to "weak",
 * where a model-specific persona lets the model self-route.
 */

export const MODE_SPEC = 0;
export const MODE_MIXED = 0.3;
export const MODE_REACT = 1;
export const MODE_WEAK = "weak";

export type Mode = number | "weak";
export type Band = "spec" | "transition" | "react" | "weak";
export type BandName = "spec" | "mixed" | "react" | "weak";

const SPEC_PERSONA = "You are a helpful software engineer assistant.";

const MIXED_PERSONA =
	"You are a helpful software engineer assistant.\n" +
	"Work directly: prefer writing or editing code over describing plans. " +
	"Verify your changes by reading and running them.";

const REACT_PERSONA =
	"You are a hands-on software engineer who delivers working output fast.\n" +
	"Work directly: write or edit code, then verify it by reading and running. " +
	"Keep the loop tight — produce, verify, fix — and do not build test " +
	"harnesses, scaffolding, or ceremony the user did not ask for. " +
	"Finish with a usable deliverable and a short summary.";

/** Weak (internal-routing) personas — model-specific optimum (upstream P11/P24). */
const WEAK_PRO =
	"You are a helpful software engineer assistant.\n" +
	"Before acting, decide the task type (build or fix) and adopt the matching " +
	"style: build → hands-on production; fix → inspect-and-plan.";

const WEAK_FLASH =
	"You are a helpful assistant.\n" +
	"Before acting, decide the task type (build or fix) and adopt the matching " +
	"style: build → hands-on production; fix → inspect-and-plan.\n" +
	"Before acting, briefly review what you have already done in this session and continue from where you left off; do not repeat completed steps. Do not run environment checks (echo, whoami, uname, node --version, date) or exhaustive grep/glob scans.\n" +
	"Think deeply first, then produce.";

/** Task-classification regexes (upstream, zh+en). */
const REACT_RE = /(开发|创建|写一个|生成|从零|做一个|游戏|网页|网站|构建|新项目|搭建|实现|做出|上线|落地|脚本|工具|应用|build|create|develop|generate|implement|make a|new project)/gi;
const SPEC_RE = /(修复|修一下|调试|重构|维护|排查|报错|出错|崩溃|优化|审查|review|fix|debug|refactor|maintain|repair|broken|break|为什么|异常|故障|迁移|升级|兼容)/gi;

function countHits(regex: RegExp, text: string): number {
	return [...text.matchAll(regex)].length;
}

/**
 * Classify a task text into a mode. Clear keyword evidence picks a stable
 * band (1 react / 0 spec); ambiguous or unmatched text returns 'weak'
 * (internal routing, model decides per task).
 */
export function classifyTask(text: string): Mode {
	const react = countHits(REACT_RE, text);
	const spec = countHits(SPEC_RE, text);
	if (react > spec) return MODE_REACT;
	if (spec > react) return MODE_SPEC;
	return MODE_WEAK;
}

/** True when the model id looks like a Flash-family model. */
export function isFlashModel(modelId: string): boolean {
	return /flash/i.test(modelId);
}

export function clamp01(v: unknown): number {
	return Math.min(1, Math.max(0, Number(v) || 0));
}

/** Quantize a mode to one of the measured behavior bands. */
export function bandOf(mode: Mode): Band {
	if (mode === "weak") return "weak";
	const m = clamp01(mode);
	if (m < 0.2) return "spec";
	if (m < 0.5) return "transition";
	return "react";
}

export function bandFor(mode: Mode): BandName {
	const b = bandOf(mode);
	return b === "transition" ? "mixed" : b;
}

/** Persona for a mode; weak picks the model-specific internal-routing text. */
export function personaFor(mode: Mode, modelId: string): string {
	switch (bandOf(mode)) {
		case "spec":
			return SPEC_PERSONA;
		case "transition":
			return MIXED_PERSONA;
		case "weak":
			return isFlashModel(modelId) ? WEAK_FLASH : WEAK_PRO;
		default:
			return REACT_PERSONA;
	}
}

/**
 * First-turn core tools for pi (names filtered against pi.getAllTools()).
 * weak gets the RL-shape surface (shell + editor) per the upstream
 * interface-restoration measurement; pi's `edit` stands in for
 * str_replace_editor, `bash` for shell.
 */
export function coreFor(mode: Mode): string[] {
	switch (bandOf(mode)) {
		case "spec":
			return ["read", "edit", "grep", "glob"]; // read-first
		case "transition":
			return ["read", "edit", "write", "grep", "glob"]; // union
		case "weak":
			return ["bash", "edit"]; // RL shape: shell + editor
		default:
			return ["bash", "read", "write", "edit"]; // write-first + shell
	}
}

/** Parse a mode token: number 0-100, 0.0-1.0, band name, or auto. */
export function parseMode(token: unknown): Mode | "auto" | null {
	if (token === undefined || token === null) return null;
	const t = String(token).trim().toLowerCase();
	if (t === "auto") return "auto";
	if (t === "weak" || t === "router") return MODE_WEAK;
	if (t === "spec" || t === "spec-lean") return MODE_SPEC;
	if (t === "balanced" || t === "mixed") return MODE_MIXED;
	if (t === "react" || t === "react-lean") return MODE_REACT;
	const n = Number(t);
	if (!Number.isFinite(n)) return null;
	if (t.includes(".")) return clamp01(n);
	return clamp01(n / 100);
}

/* ------------------------------------------------------------------ */
/* Trajectory lexicon classifier (ported from modeltest trigger_probe) */
/* ------------------------------------------------------------------ */

export interface ReasoningMetrics {
	firstLine: string;
	chars: number;
	we: number;
	letMe: number;
	i: number;
	markerFirstLine: boolean;
	visibleBeforeTool: boolean;
}

export interface ReasoningClassification {
	label: "minimal-like" | "standard-like" | "ambiguous";
	score: number;
	metrics: ReasoningMetrics;
}

function count(text: string, regex: RegExp): number {
	return [...text.matchAll(regex)].length;
}

/**
 * Classify a reasoning trace as minimal-like ("We need" collective,
 * spec-side) or standard-like ("Let me" first-person, react-side).
 * Conservative: middle scores are 'ambiguous'.
 */
export function classifyReasoning(
	reasoning: unknown,
	visibleBeforeTool = false,
): ReasoningClassification {
	const text = String(reasoning ?? "").trim();
	const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
	const metrics: ReasoningMetrics = {
		firstLine,
		chars: text.length,
		we: count(text, /\bwe\b/gi),
		letMe: count(text, /\blet me\b/gi),
		i: count(text, /\bi\b/gi),
		markerFirstLine: /^(good|great|excellent)\.?$/i.test(firstLine.trim()),
		visibleBeforeTool,
	};

	let score = 0;
	if (/^we need\b/i.test(firstLine)) score += 3;
	if (/^let me\b/i.test(firstLine)) score -= 3;
	if (metrics.we > 0 && metrics.letMe === 0) score += 2;
	if (metrics.letMe > 0) score -= 2;
	if (metrics.markerFirstLine) score += 1;
	if (visibleBeforeTool) score -= 1;

	return {
		label: score >= 4 ? "minimal-like" : score <= -4 ? "standard-like" : "ambiguous",
		score,
		metrics,
	};
}
