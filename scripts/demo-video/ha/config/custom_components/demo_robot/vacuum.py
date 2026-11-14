"""The simulated vacuum entity, with the attributes the card's Xiaomi Miio tiles read."""

from __future__ import annotations

from typing import Any

from homeassistant.components.vacuum import StateVacuumEntity, VacuumActivity, VacuumEntityFeature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.typing import ConfigType, DiscoveryInfoType

from . import DOMAIN, Robot

ACTIVITIES = {
    "docked": VacuumActivity.DOCKED,
    "cleaning": VacuumActivity.CLEANING,
    "returning": VacuumActivity.RETURNING,
    "idle": VacuumActivity.IDLE,
}


async def async_setup_platform(
    hass: HomeAssistant,
    config: ConfigType,
    async_add_entities: AddEntitiesCallback,
    discovery_info: DiscoveryInfoType | None = None,
) -> None:
    async_add_entities([DemoRobotVacuum(hass.data[DOMAIN])])


class DemoRobotVacuum(StateVacuumEntity):
    _attr_should_poll = False
    _attr_name = "Robot vacuum"
    _attr_unique_id = "demo_robot_vacuum"
    _attr_fan_speed_list = ["Quiet", "Balanced", "Turbo", "Max"]
    _attr_supported_features = (
        VacuumEntityFeature.START
        | VacuumEntityFeature.PAUSE
        | VacuumEntityFeature.STOP
        | VacuumEntityFeature.RETURN_HOME
        | VacuumEntityFeature.FAN_SPEED
        | VacuumEntityFeature.LOCATE
        | VacuumEntityFeature.SEND_COMMAND
        | VacuumEntityFeature.STATE
    )

    def __init__(self, robot: Robot) -> None:
        self._robot = robot

    async def async_added_to_hass(self) -> None:
        self._robot.add_listener(self._changed)

    def _changed(self) -> None:
        self.async_write_ha_state()

    @property
    def activity(self) -> VacuumActivity:
        return ACTIVITIES[self._robot.activity]

    @property
    def fan_speed(self) -> str:
        return self._robot.fan_speed

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        robot = self._robot
        return {
            "status": robot.status,
            "battery_level": round(robot.battery),
            "cleaned_area": round(robot.cleaned_area),
            "cleaning_time": round(robot.cleaning_time / 60),
            "filter_left": 121,
            "main_brush_left": 243,
            "side_brush_left": 98,
            "sensor_dirty_left": 18,
            "cleaning_count": 412,
        }

    async def async_start(self) -> None:
        self._robot.clean_all()

    async def async_pause(self) -> None:
        self._robot.stop()

    async def async_stop(self, **kwargs: Any) -> None:
        self._robot.stop()

    async def async_return_to_base(self, **kwargs: Any) -> None:
        self._robot.return_home()

    async def async_locate(self, **kwargs: Any) -> None:
        return None

    async def async_set_fan_speed(self, fan_speed: str, **kwargs: Any) -> None:
        self._robot.fan_speed = fan_speed
        self.async_write_ha_state()

    async def async_send_command(self, command: str, params: Any = None, **kwargs: Any) -> None:
        if command == "app_segment_clean":
            self._robot.clean_rooms([str(segment) for segment in (params or [])])
