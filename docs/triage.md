# Get help with a card problem

If a dashboard, map, room, tile or editor behaviour is wrong, collect a small diagnostic bundle
instead of a one-line report. It gives the maintainer the environment, configuration and map metadata
needed to reproduce the problem without owning your vacuum.

## Ask your agent to run the triage skill

If your coding agent supports repository skills, tell it:

> Run the triage skill for this repository and prepare a report I can send.

The skill lives in
[`.agents/skills/triage/SKILL.md`](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/blob/master/.agents/skills/triage/SKILL.md).
It will ask what went wrong, collect the card build and Home Assistant version, the vacuum
integration and map source, the card configuration, the camera's room metadata, the relevant
entities, console errors and logs. It writes everything to a local `triage-output/` folder and shows
you the redacted report before anything is posted.

It can also build a minimal fixture from your data. That is the most useful outcome for a
device-specific bug: the maintainer can turn it into a regression test and cover your integration
without the same robot on their desk.

## What it never does

- It does not upload anything automatically.
- It does not read `secrets.yaml`, auth storage, tokens or credentials.
- It does not edit your Home Assistant configuration or restart Home Assistant.
- It does not publish your map, room names or coordinates without asking.
- It does not open an issue until you have seen the final text and said yes.

A map image and room names can reveal your floor plan. The skill offers to rename rooms, shift
coordinates and omit the map. Review the redactions before sending.

## Send the bundle

After you approve the report, attach these files to a new issue:

- `triage-report.md` — the issue body.
- `triage-data.json` — the structured data.
- `attachments/` — screenshots, console output and log excerpts.
- `fixture/` — if the skill built one.

Open the [triage report form](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/issues/new?template=triage_report.yml)
and drag the files into the issue. If the skill can post with your permission, it will do that for
you.

## No agent or no local access?

Use the manual checklist:

1. Card build and version (fork or upstream) from the resource URL or release page.
2. Home Assistant version, installation type, and browser/app.
3. Vacuum model and integration, plus the map camera integration.
4. The card's YAML configuration, with tokens, IPs, serial numbers and exact coordinates removed.
5. The map camera's `rooms` and `calibration_points` attributes from **Developer Tools → States**.
6. What you expected, what happened, and the shortest steps that reproduce it.
7. Browser console errors and the Home Assistant log around the incident.
8. Screenshots of the card and the entity state.

Open the [triage report form](https://github.com/Igloczek/lovelace-better-xiaomi-vacuum-map-card/issues/new?template=triage_report.yml)
and paste the redacted values.

## For maintainers

A bundle is only useful if it becomes a test or a documented limitation. See the triage skill's
`For maintainers` section: copy the fixture, reproduce with the Vitest harness, add the regression
test, and record device-specific gaps in `FORK.md` and `ROADMAP.md` rather than claiming coverage.
