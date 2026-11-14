#!/usr/bin/env node
// Runs in .github/workflows/agent-report.yml on issue and comment events.
//
// - Strips high-confidence secrets (tokens, credentials in URLs) from any issue or comment body.
// - Labels issues that carry a valid agent report (in the body or in a comment) `agent-report`,
//   and `agent-report-incomplete` with a comment listing the missing fields when it does not validate.
// - Asks human-filed issues to hand the details to an agent.
//
// The issue text is data: it is parsed, never executed or interpolated into a shell.

import { readFile } from "node:fs/promises";
import { AGENT_LABEL, INCOMPLETE_LABEL, REDACTED_LABEL, REPO, reviewIssue } from "./core.mjs";

const BOT_MARKER = "<!-- agent-report-bot -->";
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
const issue = event.issue;
const comment = event.comment;
const dryRun = process.env.DRY_RUN === "1";

async function gh(method, path, body) {
    if (dryRun) {
        console.log(`[dry-run] ${method} ${path}${body ? ` ${JSON.stringify(body).slice(0, 200)}` : ""}`);
        return method === "GET" ? [] : {};
    }
    const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok && res.status !== 404) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
    return res.status === 204 || res.status === 404 ? null : res.json();
}

const labels = new Set((issue.labels ?? []).map((l) => (typeof l === "string" ? l : l.name)));
const addLabel = async (name) => {
    if (labels.has(name)) return;
    labels.add(name);
    await gh("POST", `/issues/${issue.number}/labels`, { labels: [name] });
};
const removeLabel = async (name) => {
    if (!labels.has(name)) return;
    labels.delete(name);
    await gh("DELETE", `/issues/${issue.number}/labels/${encodeURIComponent(name)}`);
};

// One bot comment per issue, updated in place, so edits do not pile up comments.
async function upsertBotComment(kind, text) {
    const marker = `${BOT_MARKER}<!-- ${kind} -->`;
    const comments = (await gh("GET", `/issues/${issue.number}/comments?per_page=100`)) ?? [];
    const existing = comments.find((c) => c.body?.includes(marker));
    const body = `${marker}\n${text}`;
    if (existing) await gh("PATCH", `/issues/comments/${existing.id}`, { body });
    else await gh("POST", `/issues/${issue.number}/comments`, { body });
}
async function deleteBotComment(kind) {
    const marker = `${BOT_MARKER}<!-- ${kind} -->`;
    const comments = (await gh("GET", `/issues/${issue.number}/comments?per_page=100`)) ?? [];
    for (const c of comments.filter((c) => c.body?.includes(marker))) await gh("DELETE", `/issues/comments/${c.id}`);
}

const target = comment ?? issue;
if (target.body?.includes(BOT_MARKER)) process.exit(0);
const review = reviewIssue(target.body ?? "");

if (review.redactedBody) {
    const path = comment ? `/issues/comments/${comment.id}` : `/issues/${issue.number}`;
    await gh("PATCH", path, { body: review.redactedBody });
    await addLabel(REDACTED_LABEL);
    await upsertBotComment(
        "redacted",
        `🔒 Removed what looked like secrets from this ${comment ? "comment" : "issue"} (${Object.entries(review.secretHits)
            .map(([k, n]) => `${k} ×${n}`)
            .join(", ")}). The original is still in the edit history until a maintainer deletes that revision, so revoke any Home Assistant token that was posted (Profile → Security → Long-lived access tokens).`,
    );
}

const prompt = `Read https://raw.githubusercontent.com/${REPO}/master/.agents/skills/report-problem/SKILL.md and follow it to add an agent report to ${issue.html_url}`;

if (review.isAgent) {
    if (review.complete) {
        // A complete report in a comment marks the issue too: the data is there either way.
        await addLabel(AGENT_LABEL);
        await removeLabel(INCOMPLETE_LABEL);
        await deleteBotComment("incomplete");
    } else {
        await addLabel(INCOMPLETE_LABEL);
        await upsertBotComment(
            "incomplete",
            [
                "🤖 This agent report does not validate yet, so it is not labelled `agent-report`.",
                "",
                review.error ? `- ${review.error}` : null,
                ...review.missing.map((f) => `- missing \`${f}\``),
                "",
                "To fix it, give your agent this instruction:",
                "",
                "```text",
                `${prompt} — complete the missing fields and edit the report.`,
                "```",
            ]
                .filter((l) => l !== null)
                .join("\n"),
        );
    }
} else if (!comment && event.action === "opened" && issue.user?.type !== "Bot" && !["OWNER", "MEMBER", "COLLABORATOR"].includes(issue.author_association)) {
    await upsertBotComment(
        "nudge",
        [
            "Thanks for the report. The fastest way to get this fixed is to let an AI agent collect the details: it reads your card setup, removes private data, and adds a report the maintainer can reproduce.",
            "",
            "Give your agent (Claude Code, Codex, Cursor or similar) this instruction:",
            "",
            "```text",
            prompt,
            "```",
            "",
            `Step-by-step guide: https://github.com/${REPO}/blob/master/docs/report-a-problem.md`,
        ].join("\n"),
    );
}
