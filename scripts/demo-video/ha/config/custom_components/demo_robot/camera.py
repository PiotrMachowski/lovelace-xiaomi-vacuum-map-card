"""One map camera per floor, shaped like a map-extractor camera."""

from __future__ import annotations

from typing import Any

from homeassistant.components.camera import Camera
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.typing import ConfigType, DiscoveryInfoType

from . import DOMAIN, Robot
from .floorplan import FLOORS, Floor


async def async_setup_platform(
    hass: HomeAssistant,
    config: ConfigType,
    async_add_entities: AddEntitiesCallback,
    discovery_info: DiscoveryInfoType | None = None,
) -> None:
    robot: Robot = hass.data[DOMAIN]
    async_add_entities([FloorMapCamera(robot, floor) for floor in FLOORS.values()])


class FloorMapCamera(Camera):
    _attr_should_poll = False

    def __init__(self, robot: Robot, floor: Floor) -> None:
        super().__init__()
        self._robot = robot
        self._floor = floor
        self._attr_name = f"{floor.name} map"
        self._attr_unique_id = f"demo_robot_map_{floor.key}"
        self._shown_version = 0

    async def async_added_to_hass(self) -> None:
        if self._floor is self._robot.floor:
            self._robot.add_listener(self._robot_changed)

    def _robot_changed(self) -> None:
        # A map extractor publishes a new picture when the robot moves; mirror that at most once
        # a second so the state machine is not flooded.
        if self._robot.version - self._shown_version >= 4 or self._robot.activity in ("docked", "idle"):
            self._shown_version = self._robot.version
            self.async_write_ha_state()

    @property
    def entity_picture(self) -> str:
        version = self._shown_version if self._floor is self._robot.floor else 1
        return f"/api/demo_robot/map/{self._floor.key}?v={version}"

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {
            "calibration_points": self._floor.calibration_points(),
            "rooms": self._floor.rooms_metadata(),
            "access_token": "demo",
        }

    async def async_camera_image(self, width: int | None = None, height: int | None = None) -> bytes | None:
        return await self.hass.async_add_executor_job(self._robot.image, self._floor)
