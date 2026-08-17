import assert from "node:assert";
import { test } from "node:test";
import {
	MODE_WEAK,
	bandOf,
	classifyReasoning,
	classifyTask,
	coreFor,
	parseMode,
	personaFor,
} from "./router-core.ts";

test("classifyTask: build keywords → react, fix keywords → spec, else weak", () => {
	assert.equal(classifyTask("帮我从零写一个网页小游戏"), 1);
	assert.equal(classifyTask("build a new project from scratch"), 1);
	assert.equal(classifyTask("修复这个报错，调试一下为什么崩溃"), 0);
	assert.equal(classifyTask("fix the broken migration"), 0);
	assert.equal(classifyTask("看看这个文件"), MODE_WEAK);
});

test("bandOf quantizes to measured stable regions", () => {
	assert.equal(bandOf(0), "spec");
	assert.equal(bandOf(0.3), "transition");
	assert.equal(bandOf(1), "react");
	assert.equal(bandOf(MODE_WEAK), "weak");
});

test("weak persona is model-specific (flash vs pro)", () => {
	assert.match(personaFor(MODE_WEAK, "deepseek-v4-flash"), /^You are a helpful assistant\./);
	assert.match(personaFor(MODE_WEAK, "deepseek-v4-pro"), /software engineer assistant/);
});

test("coreFor: weak gets RL-shape bash+edit", () => {
	assert.deepEqual(coreFor(MODE_WEAK), ["bash", "edit"]);
	assert.ok(coreFor(0).includes("read") && !coreFor(0).includes("bash"));
	assert.ok(coreFor(1).includes("write"));
});

test("parseMode tokens", () => {
	assert.equal(parseMode("auto"), "auto");
	assert.equal(parseMode("weak"), MODE_WEAK);
	assert.equal(parseMode("spec"), 0);
	assert.equal(parseMode("react"), 1);
	assert.equal(parseMode("30"), 0.3);
	assert.equal(parseMode("0.3"), 0.3);
	assert.equal(parseMode("nonsense"), null);
});

test("classifyReasoning: We-need minimal-like, Let-me standard-like", () => {
	assert.equal(
		classifyReasoning("We need to inspect the repository. We should read the README first.").label,
		"minimal-like",
	);
	assert.equal(
		classifyReasoning("Let me check the file. Let me run the tests. I'll fix it.").label,
		"standard-like",
	);
	assert.equal(classifyReasoning("").label, "ambiguous");
});
