"""A simulated robot vacuum for recording the README demo video.

It serves a rendered map for two floors, exposes the room metadata and calibration points map
integrations provide, and answers the Xiaomi Miio services the card's default templates call by
driving the robot around the map. It exists only for `scripts/demo-video`; it is never part of the
released card and does not talk to a real device.
"""

from __future__ import annotations

import asyncio
import math
from collections.abc import Callable
from typing import Any

from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers.discovery import async_load_platform
from homeassistant.helpers.typing import ConfigType

from .floorplan import FLOORS, GROUND, Floor, render, to_image

DOMAIN = "demo_robot"
SPEED_PX_PER_S = 34
TICK_S = 0.25
LANE_PX = 16
INSET_PX = 11


def _zigzag(rect: tuple[float, float, float, float]) -> list[tuple[float, float]]:
    left, top, right, bottom = rect[0] + INSET_PX, rect[1] + INSET_PX, rect[2] - INSET_PX, rect[3] - INSET_PX
    if right <= left or bottom <= top:
        return [((rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2)]
    points: list[tuple[float, float]] = []
    y = top
    forward = True
    while y <= bottom:
        points += [(left, y), (right, y)] if forward else [(right, y), (left, y)]
        forward = not forward
        y += LANE_PX
    return points


class Robot:
    """Position, route and status of the one simulated vacuum on the ground floor."""

    def __init__(self, hass: HomeAssistant, floor: Floor) -> None:
        self.hass = hass
        self.floor = floor
        dock = floor.dock or (0, 0)
        self.x, self.y = float(dock[0]), float(dock[1])
        self.heading = -math.pi / 2
        self.path: list[tuple[float, float]] = []
        self.route: list[tuple[float, float]] = []
        self.activity = "docked"
        self.status = "Charging"
        self.battery = 100.0
        self.fan_speed = "Turbo"
        self.cleaned_area = 0.0
        self.cleaning_time = 0.0
        self.version = 1
        self._task: asyncio.Task | None = None
        self._listeners: list[Callable[[], None]] = []

    def add_listener(self, listener: Callable[[], None]) -> None:
        self._listeners.append(listener)

    def _notify(self) -> None:
        for listener in self._listeners:
            listener()

    # Routing -----------------------------------------------------------------------------------

    def _route_to(self, x: float, y: float) -> list[tuple[float, float]]:
        """Through the current room's door, the hallway and the target room's door."""
        here = self.floor.room_at(self.x, self.y)
        there = self.floor.room_at(x, y)
        points: list[tuple[float, float]] = []
        if here and there and here.id == there.id:
            return [(x, y)]
        if here and here.id != self.floor.hall_id:
            points += [here.door_inside, here.door_outside]
        if there and there.id != self.floor.hall_id:
            points += [there.door_outside, there.door_inside]
        points.append((x, y))
        return points

    def _clean_rects(self, rects: list[tuple[float, float, float, float]]) -> None:
        route: list[tuple[float, float]] = []
        for rect in rects:
            lanes = _zigzag(rect)
            start = route[-1] if route else (self.x, self.y)
            saved = self.x, self.y
            self.x, self.y = start
            route += self._route_to(*lanes[0])
            self.x, self.y = saved
            route += lanes[1:]
        self._start(route, "cleaning", "Cleaning", return_home=True)

    def clean_rooms(self, room_ids: list[str]) -> None:
        rects = []
        for room_id in room_ids:
            room = self.floor.room(str(room_id))
            if room:
                rects += room.rects
        if rects:
            self._clean_rects(rects)

    def clean_all(self) -> None:
        self.clean_rooms([room.id for room in self.floor.rooms])

    def clean_zones(self, zones: list[list[float]]) -> None:
        rects = []
        for zone in zones:
            x0, y0 = to_image(zone[0], zone[1])
            x1, y1 = to_image(zone[2], zone[3])
            rects.append((min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)))
        if rects:
            self._clean_rects(rects)

    def go_to(self, vx: float, vy: float) -> None:
        self._start(self._route_to(*to_image(vx, vy)), "cleaning", "Going to target", return_home=False)

    def follow(self, points: list[list[float]]) -> None:
        route: list[tuple[float, float]] = []
        for point in points:
            route.append(to_image(point[0], point[1]))
        self._start(route, "cleaning", "Following path", return_home=False)

    def return_home(self) -> None:
        if self.floor.dock:
            self._start(self._route_to(*self.floor.dock), "returning", "Returning home", return_home=False)

    def stop(self) -> None:
        if self._task:
            self._task.cancel()
            self._task = None
        self.route = []
        self.activity = "idle"
        self.status = "Idle"
        self._notify()

    # Motion ------------------------------------------------------------------------------------

    def _start(self, route: list[tuple[float, float]], activity: str, status: str, return_home: bool) -> None:
        if self._task:
            self._task.cancel()
        if self.activity == "docked":
            self.path = [(self.x, self.y)]
        self.route = list(route)
        self.activity = activity
        self.status = status
        self._notify()
        self._task = self.hass.async_create_background_task(self._drive(return_home), "demo_robot drive")

    async def _drive(self, return_home: bool) -> None:
        try:
            while self.route:
                await asyncio.sleep(TICK_S)
                step = SPEED_PX_PER_S * TICK_S
                while step > 0 and self.route:
                    tx, ty = self.route[0]
                    dx, dy = tx - self.x, ty - self.y
                    distance = math.hypot(dx, dy)
                    if distance > 0.01:
                        self.heading = math.atan2(dy, dx)
                    if distance <= step:
                        self.x, self.y = tx, ty
                        self.route.pop(0)
                        step -= distance
                        self.path.append((self.x, self.y))
                    else:
                        self.x += dx / distance * step
                        self.y += dy / distance * step
                        step = 0
                if self.activity == "cleaning":
                    self.cleaned_area += 0.02
                    self.cleaning_time += TICK_S
                    self.battery = max(5.0, self.battery - 0.02)
                self.version += 1
                self._notify()
            if return_home and self.floor.dock:
                self.activity = "returning"
                self.status = "Returning home"
                self.route = self._route_to(*self.floor.dock)
                self._notify()
                await self._drive(return_home=False)
                return
            if self.floor.dock and (round(self.x), round(self.y)) == tuple(self.floor.dock):
                self.activity = "docked"
                self.status = "Charging"
                # Charging is instant here, so every recording starts from a full battery.
                self.battery = 100.0
                self.cleaned_area = 0.0
                self.cleaning_time = 0.0
            else:
                self.activity = "idle"
                self.status = "Idle"
            self.version += 1
            self._notify()
        except asyncio.CancelledError:
            pass

    def image(self, floor: Floor) -> bytes:
        if floor is not self.floor:
            return render(floor, None, [])
        robot = (self.x, self.y, self.heading)
        path = self.path if self.activity != "docked" else []
        return render(floor, robot, path)


class MapImageView(HomeAssistantView):
    """Serves the current map of a floor as a PNG."""

    url = "/api/demo_robot/map/{floor}"
    name = "api:demo_robot:map"
    requires_auth = False

    def __init__(self, robot: Robot) -> None:
        self.robot = robot

    async def get(self, request: web.Request, floor: str) -> web.Response:
        target = FLOORS.get(floor)
        if target is None:
            return web.Response(status=404)
        body = await self.robot.hass.async_add_executor_job(self.robot.image, target)
        return web.Response(body=body, content_type="image/png", headers={"Cache-Control": "no-store"})


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    robot = Robot(hass, GROUND)
    hass.data[DOMAIN] = robot
    hass.http.register_view(MapImageView(robot))

    # The card's default (Xiaomi Miio) templates call these services.
    async def clean_segment(call: ServiceCall) -> None:
        segments = call.data.get("segments", [])
        robot.clean_rooms([str(segment) for segment in (segments if isinstance(segments, list) else [segments])])

    async def clean_zone(call: ServiceCall) -> None:
        zones = call.data.get("zone", [])
        robot.clean_zones([[float(value) * 1000 for value in zone[:4]] for zone in zones])

    async def goto(call: ServiceCall) -> None:
        robot.go_to(float(call.data["x_coord"]) * 1000, float(call.data["y_coord"]) * 1000)

    async def follow_path(call: ServiceCall) -> None:
        path: list[Any] = call.data.get("path", [])
        robot.follow([[float(point[0]) * 1000, float(point[1]) * 1000] for point in path])

    hass.services.async_register("xiaomi_miio", "vacuum_clean_segment", clean_segment)
    hass.services.async_register("xiaomi_miio", "vacuum_clean_zone", clean_zone)
    hass.services.async_register("xiaomi_miio", "vacuum_goto", goto)
    hass.services.async_register(DOMAIN, "follow_path", follow_path)

    for platform in ("camera", "vacuum"):
        hass.async_create_task(async_load_platform(hass, platform, DOMAIN, {}, config))
    return True
