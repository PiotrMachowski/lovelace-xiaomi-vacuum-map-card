"""A controllable camera fixture for the end-to-end suite.

The camera serves a committed PNG through this integration's own HTTP view, so every image load the
card performs is counted. A service bumps the entity picture and the state object, which is what a
real camera does when it has a new map, and the counter proves how often the card actually asks for
one.

This component exists only for `test/e2e`; it is never part of the released card.
"""

from __future__ import annotations

import os
from typing import Any

from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers.typing import ConfigType

DOMAIN = "map_fixture"
DATA_COUNTS = "map_fixture_counts"
DATA_IMAGE = "map_fixture_image"

DEFAULT_IMAGE = "/config/map_fixture.png"

# The synthetic fixture map, in vacuum coordinates. The committed PNG is 200x150 and the card's
# calibration maps 1 image pixel to 10 vacuum units, so these rectangles match the coloured blobs.
FIXTURE_ROOMS: dict[str, dict[str, Any]] = {
    "0": {"x0": 200, "y0": 200, "x1": 800, "y1": 700, "name": "Kitchen"},
    "1": {"x0": 1000, "y0": 200, "x1": 1700, "y1": 700, "name": "Living room"},
    "2": {"x0": 200, "y0": 900, "x1": 800, "y1": 1300, "name": "Bedroom"},
}

# A re-map that keeps the geometry but renumbers the segments, which is what makes a configured
# selection stale without looking different on the map.
SHIFTED_ROOMS: dict[str, dict[str, Any]] = {
    "7": {"x0": 200, "y0": 200, "x1": 800, "y1": 700, "name": "Kitchen"},
    "8": {"x0": 1000, "y0": 200, "x1": 1700, "y1": 700, "name": "Living room"},
    "9": {"x0": 200, "y0": 900, "x1": 800, "y1": 1300, "name": "Bedroom"},
}


class MapFixtureImageView(HomeAssistantView):
    """Serves the fixture map and counts each request."""

    url = "/api/map_fixture/image"
    name = "api:map_fixture:image"
    requires_auth = False

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    async def get(self, request: web.Request) -> web.Response:
        counts: dict[str, int] = self.hass.data.setdefault(DATA_COUNTS, {})
        token = request.query.get("v", "default")
        counts[token] = counts.get(token, 0) + 1
        counts["total"] = counts.get("total", 0) + 1
        path = self.hass.data.get(DATA_IMAGE, DEFAULT_IMAGE)
        if not os.path.exists(path):
            return web.Response(status=404, text=f"missing fixture image: {path}")
        with open(path, "rb") as handle:
            body = handle.read()
        return web.Response(body=body, content_type="image/png", headers={"Cache-Control": "no-store"})


class MapFixtureStatsView(HomeAssistantView):
    """Reads and resets the request counter."""

    url = "/api/map_fixture/stats"
    name = "api:map_fixture:stats"
    requires_auth = False

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass

    async def get(self, request: web.Request) -> web.Response:
        return web.json_response(self.hass.data.setdefault(DATA_COUNTS, {}))

    async def post(self, request: web.Request) -> web.Response:
        self.hass.data[DATA_COUNTS] = {}
        return web.json_response({"reset": True})


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the views and the bump service."""
    hass.data.setdefault(DATA_IMAGE, DEFAULT_IMAGE)
    hass.http.register_view(MapFixtureImageView(hass))
    hass.http.register_view(MapFixtureStatsView(hass))

    async def bump(call: ServiceCall) -> None:
        for entities in hass.data.get("map_fixture_entities", {}).values():
            for entity in entities:
                entity.bump()

    hass.services.async_register(DOMAIN, "bump", bump)

    async def set_image(call: ServiceCall) -> None:
        hass.data[DATA_IMAGE] = call.data.get("path", DEFAULT_IMAGE)

    hass.services.async_register(DOMAIN, "set_image", set_image)

    async def set_rooms(call: ServiceCall) -> None:
        """Swap the room metadata between the original ids and a re-mapped set."""
        shift = call.data.get("mode", "shift") == "shift"
        rooms = SHIFTED_ROOMS if shift else FIXTURE_ROOMS
        for entities in hass.data.get("map_fixture_entities", {}).values():
            for entity in entities:
                entity.set_rooms(rooms)

    hass.services.async_register(DOMAIN, "set_rooms", set_rooms)
    return True
