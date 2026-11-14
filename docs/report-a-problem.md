# Report a problem

Something wrong with the map, rooms, tiles or the editor? Let an AI agent report it for you. You
describe the problem in your own words; the agent finds your card setup, removes private data,
works out what it can, and files a report the maintainer can reproduce.

You do less work, and the maintainer gets a report with the versions, configuration and data needed
to fix it. Agent reports are labelled **`agent-report`** on the tracker, and they get looked at first.

## What you need

- An AI agent that can run commands on your computer, such as **Claude Code**, **Codex**,
  **Cursor**, or a similar coding agent. A chat window that cannot run commands is not enough.
- Your Home Assistant open in a browser.

You do not need to know YAML, find log files or open developer tools.

## Three steps

### 1. Give your agent this instruction

Copy it, and replace the last line with your problem:

```text
Read https://raw.githubusercontent.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/master/.agents/skills/report-problem/SKILL.md
and follow it to report this problem with my vacuum map card:

<describe what is wrong, e.g. "the room outlines are shifted after I rotate the map">
```

Describe what you see, not what you think the cause is. "Clicking the kitchen selects the hallway"
is perfect.

### 2. Give it access when it asks

The agent will ask for a temporary Home Assistant access key (a "long-lived access token"):

1. In Home Assistant, click your name in the bottom-left corner.
2. Open the **Security** tab.
3. Scroll to **Long-lived access tokens** and choose **Create token**.
4. Name it `vacuum card report`, copy the token, and paste it to the agent with the address you use
   to open Home Assistant (for example `http://homeassistant.local:8123`).

The agent only reads. Delete the token on the same page when the report is filed.

If your agent can control your browser, it may use your open Home Assistant tab instead and not
ask for a token.

### 3. Get the link

The agent files the report on GitHub and gives you the link. That is all. If it finds that the
problem is a setting or an outdated version rather than a bug, it tells you how to fix it instead
of filing anything.

## If the maintainer asks something

You will get a GitHub notification. Give your agent the issue link:

```text
Read https://raw.githubusercontent.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/master/.agents/skills/report-problem/SKILL.md
and answer the maintainer's questions on <issue link>.
```

The same works for an issue you already filed by hand: point your agent at it and it adds the
missing details.

## What leaves your computer

The report contains your card configuration, the vacuum and map entities the card uses, their
attributes (including room names and room coordinates, which map bugs need), integration and Home
Assistant versions, and related log lines.

It never contains:

- your access token, passwords or any other secret;
- IP addresses, MAC addresses, serial numbers or email addresses;
- your home location, Home Assistant address, or the names you gave your devices and entities
  (entities are renamed to neutral names like `vacuum.vacuum` and `image.map`);
- the map image.

The agent does not change anything in Home Assistant. The removal of private data is done by the
report tool, not left to the agent's judgement, and the repository checks every issue for leaked
tokens and removes them.

## No agent?

Use the [bug form](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/issues/new?template=bug_report.yml).
It asks for the card and Home Assistant versions, the vacuum integration, the card configuration
and the browser console errors. Hand-written reports take longer to reproduce, so expect a bot to
suggest an agent report.

## For agents and maintainers

The procedure is the [report-problem skill](../.agents/skills/report-problem/SKILL.md); the tooling
is in [`scripts/agent-report/`](../scripts/agent-report/), and the issue workflow is
[`agent-report.yml`](../.github/workflows/agent-report.yml).
