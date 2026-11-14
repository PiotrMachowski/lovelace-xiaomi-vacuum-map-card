#!/usr/bin/env node
/*
 * Offline documentation link check.
 *
 * Verifies every relative link and anchor in README.md, CONTRIBUTING.md, FORK.md, docs/**\/*.md,
 * .agents/**\/*.md and the GitHub issue forms. External URLs are not fetched; links that point back
 * into this fork through a github.com/Igloczek/.../blob/... URL are resolved against the working
 * tree instead. Upstream PiotrMachowski URLs stay external and are not resolved against the fork
 * tree.
 *
 * Usage: node scripts/check-docs-links.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const repoUrl = /^https?:\/\/github\.com\/Igloczek\/(?:lovelace-better-xiaomi-vacuum-map-card|lovelace-xiaomi-vacuum-map-card)\/(?:blob|tree|raw)\/(?:master|main)\/(.+)$/;
const external = /^(?:https?:)?\/\//i;

function walk(directory) {
    return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
        const relative = path.posix.join(directory, entry.name);
        return entry.isDirectory() ? walk(relative) : [relative];
    });
}

function filesToCheck() {
    const explicit = ['README.md', 'CONTRIBUTING.md', 'FORK.md'];
    return explicit
        .concat(walk('docs').filter((file) => file.endsWith('.md')))
        .concat(walk('.agents').filter((file) => file.endsWith('.md')))
        .concat(walk('.github/ISSUE_TEMPLATE').filter((file) => /\.ya?ml$/.test(file)))
        .sort();
}

function withoutCodeBlocks(text) {
    // Keep newlines so reported line numbers stay correct.
    return text.replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, ''));
}

function headings(text) {
    const anchors = new Map();
    // A '#' line inside a fenced block is code, not a heading, so strip fences first.
    text = withoutCodeBlocks(text);
    const add = (name) => {
        const count = anchors.get(name) || 0;
        anchors.set(count === 0 ? name : `${name}-${count}`, true);
        anchors.set(name, count + 1);
    };

    for (const line of text.split(/\r?\n/)) {
        const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
        if (heading) {
            let label = heading[2]
                .replace(/<[^>]+>/g, '')
                .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
                .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
                // GitHub keeps underscores in heading slugs; strip only other inline markers.
                .replace(/[`*~]/g, '')
                .trim()
                .toLowerCase()
                .replace(/[^\p{L}\p{N}\- _]/gu, '')
                .replace(/\s+/g, '-');
            add(label);
        }
        for (const anchor of line.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) {
            anchors.set(anchor[1], true);
        }
    }
    return anchors;
}

function anchorsOf(relative) {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute) || !relative.endsWith('.md')) return null;
    return headings(fs.readFileSync(absolute, 'utf8'));
}

function lineOf(text, index) {
    return text.slice(0, index).split('\n').length;
}

const problems = [];
let checked = 0;

for (const relative of filesToCheck()) {
    const text = withoutCodeBlocks(fs.readFileSync(path.join(root, relative), 'utf8'));
    const pattern = /!?\[[^\]]*\]\(\s*([^)\s]+?)(?:\s+["'][^"']*["'])?\s*\)|\b(?:href|src)=["']([^"']+)["']/g;

    for (const match of text.matchAll(pattern)) {
        const target = (match[1] || match[2] || '').replace(/^<|>$/g, '');
        if (!target || /^(?:mailto:|tel:|data:|javascript:)/i.test(target)) continue;

        const location = `${relative}:${lineOf(text, match.index)}`;

        if (external.test(target) && !repoUrl.test(target)) continue;

        let local = target;
        let fragment = '';
        const hash = local.indexOf('#');
        if (hash >= 0) {
            fragment = local.slice(hash + 1);
            local = local.slice(0, hash);
        }
        local = local.split('?')[0];

        if (!local) {
            const anchors = anchorsOf(relative);
            if (fragment && anchors && !anchors.has(decodeURIComponent(fragment))) {
                problems.push(`${location}: missing anchor #${fragment} in ${relative}`);
            }
            checked += 1;
            continue;
        }

        const repoMatch = local.match(repoUrl);
        const resolved = repoMatch
            ? path.posix.normalize(repoMatch[1])
            : local.startsWith('/')
              ? path.posix.normalize(local.slice(1))
              : path.posix.normalize(path.posix.join(path.posix.dirname(relative), local));

        const decoded = decodeURIComponent(resolved);
        const absolute = path.join(root, decoded);
        checked += 1;

        if (!fs.existsSync(absolute)) {
            problems.push(`${location}: missing file ${decoded}`);
            continue;
        }

        if (fragment && decoded.endsWith('.md')) {
            const anchors = anchorsOf(decoded);
            if (anchors && !anchors.has(decodeURIComponent(fragment))) {
                problems.push(`${location}: missing anchor #${fragment} in ${decoded}`);
            }
        }
    }
}

if (problems.length > 0) {
    console.error(`Documentation links: ${problems.length} problem(s) in ${checked} link(s).`);
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
}

console.log(`Documentation links: ${checked} link(s) in ${filesToCheck().length} file(s) OK.`);
