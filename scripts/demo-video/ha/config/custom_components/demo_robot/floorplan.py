"""An invented two-floor home and a renderer that draws it the way map integrations do.

Every room is a union of rectangles in image pixels, filled with one flat colour, so the card's
room-colour detection traces its real (non-rectangular) outline. Walls are the gaps between rooms,
doors are short grey bridges, and furniture is unscanned floor inside a room. None of this is a real
home.
"""

from __future__ import annotations

import io
import math
from dataclasses import dataclass, field

from PIL import Image, ImageDraw

# 1 image pixel = 20 mm. The vacuum's y axis points up, like Xiaomi's.
MM_PER_PX = 20
# The PNG is drawn at twice the floor-plan resolution so the map stays sharp when zoomed.
RENDER_SCALE = 2
ORIGIN_X = 20000
ORIGIN_Y = 30000

WALL = (92, 99, 112, 255)
DOOR = (196, 200, 207, 255)
FURNITURE = (176, 181, 189, 255)
CHARGER = (40, 200, 120, 255)


def to_vacuum(x: float, y: float) -> tuple[int, int]:
    return round(ORIGIN_X + x * MM_PER_PX), round(ORIGIN_Y - y * MM_PER_PX)


def to_image(x: float, y: float) -> tuple[float, float]:
    return (x - ORIGIN_X) / MM_PER_PX, (ORIGIN_Y - y) / MM_PER_PX


@dataclass
class Room:
    id: str
    name: str
    color: tuple[int, int, int, int]
    rects: list[tuple[int, int, int, int]]
    # A point just inside the door, and one just outside it in the hallway.
    door_inside: tuple[int, int]
    door_outside: tuple[int, int]
    furniture: list[tuple[int, int, int, int]] = field(default_factory=list)

    def contains(self, x: float, y: float) -> bool:
        return any(r[0] <= x <= r[2] and r[1] <= y <= r[3] for r in self.rects)

    @property
    def bounds(self) -> tuple[int, int, int, int]:
        return (
            min(r[0] for r in self.rects),
            min(r[1] for r in self.rects),
            max(r[2] for r in self.rects),
            max(r[3] for r in self.rects),
        )

    def metadata(self) -> dict:
        left, top, right, bottom = self.bounds
        x0, y1 = to_vacuum(left, top)
        x1, y0 = to_vacuum(right, bottom)
        return {"x0": x0, "y0": y0, "x1": x1, "y1": y1, "name": self.name}


@dataclass
class Floor:
    key: str
    name: str
    size: tuple[int, int]
    rooms: list[Room]
    doors: list[tuple[int, int, int, int]]
    hall_id: str
    dock: tuple[int, int] | None

    def room(self, room_id: str) -> Room | None:
        return next((room for room in self.rooms if room.id == str(room_id)), None)

    def room_at(self, x: float, y: float) -> Room | None:
        return next((room for room in self.rooms if room.contains(x, y)), None)

    def calibration_points(self) -> list[dict]:
        points = [(0, 0), (self.size[0], 0), (0, self.size[1])]
        result = []
        for x, y in points:
            vx, vy = to_vacuum(x, y)
            result.append({"map": {"x": x * RENDER_SCALE, "y": y * RENDER_SCALE}, "vacuum": {"x": vx, "y": vy}})
        return result

    def rooms_metadata(self) -> dict:
        return {room.id: room.metadata() for room in self.rooms}


GROUND = Floor(
    key="ground",
    name="Ground floor",
    size=(760, 520),
    hall_id="19",
    dock=(120, 378),
    rooms=[
        Room(
            "16",
            "Living room",
            (82, 186, 120, 255),
            [(30, 30, 330, 250), (30, 250, 230, 400)],
            door_inside=(312, 230),
            door_outside=(360, 230),
            furniture=[(50, 50, 80, 170), (130, 150, 230, 175), (200, 330, 228, 398)],
        ),
        Room(
            "17",
            "Kitchen",
            (240, 168, 70, 255),
            [(340, 30, 540, 200)],
            door_inside=(445, 180),
            door_outside=(445, 225),
            furniture=[(340, 30, 540, 52), (420, 100, 480, 130)],
        ),
        Room(
            "18",
            "Office",
            (84, 144, 222, 255),
            [(550, 30, 730, 250)],
            door_inside=(570, 230),
            door_outside=(525, 230),
            furniture=[(640, 32, 728, 70)],
        ),
        Room(
            "19",
            "Hallway",
            (226, 104, 126, 255),
            [(340, 210, 540, 330), (240, 260, 340, 330)],
            door_inside=(440, 270),
            door_outside=(440, 270),
        ),
        Room(
            "20",
            "Bathroom",
            (54, 186, 178, 255),
            [(240, 340, 400, 490)],
            door_inside=(290, 360),
            door_outside=(290, 315),
            furniture=[(330, 420, 398, 488)],
        ),
        Room(
            "21",
            "Bedroom",
            (152, 112, 212, 255),
            [(410, 340, 730, 490), (550, 260, 730, 340)],
            door_inside=(570, 300),
            door_outside=(525, 300),
            furniture=[(600, 380, 700, 470)],
        ),
    ],
    doors=[
        (330, 215, 340, 245),
        (230, 268, 240, 300),
        (425, 200, 465, 210),
        (540, 215, 550, 245),
        (270, 330, 310, 340),
        (540, 282, 550, 318),
    ],
)

FIRST = Floor(
    key="first",
    name="First floor",
    size=(620, 460),
    hall_id="33",
    dock=None,
    rooms=[
        Room("30", "Master bedroom", (152, 112, 212, 255), [(30, 30, 300, 260)], (280, 240), (330, 240),
             furniture=[(80, 60, 200, 160)]),
        Room("31", "Kids room", (240, 168, 70, 255), [(310, 30, 590, 200)], (450, 180), (450, 225),
             furniture=[(520, 40, 588, 120)]),
        Room("32", "Bathroom", (54, 186, 178, 255), [(30, 270, 220, 430)], (200, 290), (200, 245),
             furniture=[(32, 360, 110, 428)]),
        Room("33", "Landing", (226, 104, 126, 255), [(310, 210, 590, 290), (230, 230, 310, 430)],
             (400, 250), (400, 250)),
        Room("34", "Study", (84, 144, 222, 255), [(320, 300, 590, 430)], (360, 320), (360, 280),
             furniture=[(500, 380, 588, 428)]),
    ],
    doors=[
        (300, 225, 310, 255),
        (430, 200, 470, 210),
        (220, 300, 230, 340),
        (345, 290, 385, 300),
    ],
)

FLOORS = {GROUND.key: GROUND, FIRST.key: FIRST}


def _robot(draw: ImageDraw.ImageDraw, x: float, y: float, heading: float) -> None:
    radius = 9 * RENDER_SCALE
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(250, 250, 250, 255), outline=(40, 44, 52, 255), width=2 * RENDER_SCALE)
    lidar = 3 * RENDER_SCALE
    draw.ellipse((x - lidar, y - lidar, x + lidar, y + lidar), fill=(40, 44, 52, 255))
    tip = (x + math.cos(heading) * (radius - 2), y + math.sin(heading) * (radius - 2))
    draw.line((x, y, tip[0], tip[1]), fill=(40, 44, 52, 255), width=2 * RENDER_SCALE)


def render(floor: Floor, robot: tuple[float, float, float] | None, path: list[tuple[float, float]]) -> bytes:
    """Draws the floor as a PNG: walls, rooms, doors, furniture, the cleaned path and the robot."""
    scale = RENDER_SCALE
    width, height = floor.size
    image = Image.new("RGBA", (width * scale, height * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    def box(rect: tuple[float, float, float, float], grow: float = 0) -> tuple[float, float, float, float]:
        return ((rect[0] - grow) * scale, (rect[1] - grow) * scale, (rect[2] + grow) * scale - 1, (rect[3] + grow) * scale - 1)

    # Walls: every room grown by the wall thickness, painted first so the room fills sit on top.
    for room in floor.rooms:
        for rect in room.rects:
            draw.rectangle(box(rect, 6), fill=WALL)
    for room in floor.rooms:
        for rect in room.rects:
            draw.rectangle(box(rect), fill=room.color)
    for rect in floor.doors:
        draw.rectangle(box(rect), fill=DOOR)
    for room in floor.rooms:
        for rect in room.furniture:
            draw.rounded_rectangle(box(rect), radius=4 * scale, fill=FURNITURE)

    if floor.dock:
        dx, dy = floor.dock
        draw.rounded_rectangle(box((dx - 10, dy + 14, dx + 10, dy + 21)), radius=3 * scale, fill=CHARGER)

    if len(path) > 1:
        draw.line([(x * scale, y * scale) for x, y in path], fill=(255, 255, 255, 235), width=2 * scale, joint="curve")

    if robot:
        x, y, heading = robot
        layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
        _robot(ImageDraw.Draw(layer), x * scale, y * scale, heading)
        image = Image.alpha_composite(image, layer)

    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=False)
    return buffer.getvalue()
