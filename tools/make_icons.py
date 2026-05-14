#!/usr/bin/env python3
"""Generate Lift PWA icons.

Uses Pillow when it is installed. If Pillow is unavailable, a small built-in
RGBA rasterizer writes valid PNGs with the same dumbbell glyph and gradient.
"""

from __future__ import annotations

import binascii
import struct
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "icons"
BLUE = (10, 132, 255, 255)
TEAL = (35, 209, 207, 255)
PINK = (255, 45, 85, 255)
ORANGE = (255, 149, 0, 255)
SHADOW = (18, 24, 38, 70)
WHITE = (255, 255, 255, 255)

GLYPH = (
    ((88, 204, 146, 308), 14),
    ((156, 184, 204, 328), 14),
    ((196, 238, 316, 274), 18),
    ((308, 184, 356, 328), 14),
    ((366, 204, 424, 308), 14),
)

SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-labelledby="title desc">
  <title id="title">Lift icon</title>
  <desc id="desc">White dumbbell glyph on a vibrant glass gradient background.</desc>
  <defs>
    <linearGradient id="bg" x1="70" y1="56" x2="450" y2="462" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0a84ff"/>
      <stop offset=".46" stop-color="#ff2d55"/>
      <stop offset="1" stop-color="#ff9500"/>
    </linearGradient>
    <linearGradient id="shine" x1="92" y1="28" x2="398" y2="390" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity=".54"/>
      <stop offset=".42" stop-color="#fff" stop-opacity=".12"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <filter id="lift-shadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#111827" flood-opacity=".28"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="108" fill="url(#bg)"/>
  <path d="M40 110C148 44 284 24 472 50v226C314 234 180 274 40 396Z" fill="url(#shine)"/>
  <path d="M0 356c118-56 212-54 326 5 70 37 125 46 186 20v131H0Z" fill="#23d1cf" opacity=".18"/>
  <g fill="#fff" filter="url(#lift-shadow)">
    <rect x="88" y="204" width="58" height="104" rx="14"/>
    <rect x="156" y="184" width="48" height="144" rx="14"/>
    <rect x="196" y="238" width="120" height="36" rx="18"/>
    <rect x="308" y="184" width="48" height="144" rx="14"/>
    <rect x="366" y="204" width="58" height="104" rx="14"/>
  </g>
</svg>
"""


def main() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    (ICON_DIR / "icon.svg").write_text(SVG, encoding="utf-8")

    try:
        from PIL import Image, ImageDraw  # type: ignore
    except ModuleNotFoundError:
        for size, maskable, name in output_specs():
            write_png_fallback(ICON_DIR / name, size, maskable)
    else:
        for size, maskable, name in output_specs():
            write_png_pillow(ICON_DIR / name, size, maskable, Image, ImageDraw)

    write_badge(ICON_DIR / "badge.png")


def output_specs():
    return (
        (192, False, "icon-192.png"),
        (512, False, "icon-512.png"),
        (192, True, "maskable-192.png"),
        (512, True, "maskable-512.png"),
        (512, True, "icon-maskable-512.png"),
    )


def write_badge(path: Path) -> None:
    """96×96 monochrome badge: white dumbbell on transparent background.

    Android status-bar badges must be alpha-only. This writes the glyph in
    white with full opacity and leaves every other pixel transparent so the
    OS can tint it correctly.
    """
    size = 96
    pixels = bytearray(size * size * 4)  # all transparent RGBA

    for rect, radius in GLYPH:
        coords, scaled_radius = transformed(rect, radius, size, False)
        fill_round_rect(pixels, size, coords, scaled_radius, WHITE)

    path.write_bytes(encode_png_rgba(size, size, pixels))


def transformed(rect: tuple[int, int, int, int], radius: int, size: int, maskable: bool):
    factor = 0.78 if maskable else 1.0
    scale = size / 512
    cx = cy = 256
    x1, y1, x2, y2 = rect
    coords = (
        round((cx + (x1 - cx) * factor) * scale),
        round((cy + (y1 - cy) * factor) * scale),
        round((cx + (x2 - cx) * factor) * scale),
        round((cy + (y2 - cy) * factor) * scale),
    )
    return coords, max(1, round(radius * factor * scale))


def write_png_pillow(path: Path, size: int, maskable: bool, Image, ImageDraw) -> None:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pixels = image.load()
    for y in range(size):
        for x in range(size):
            pixels[x, y] = gradient_color(x, y, size)
    draw = ImageDraw.Draw(image)
    for rect, radius in GLYPH:
        coords, scaled_radius = transformed(rect, radius, size, maskable)
        shadow = (coords[0], coords[1] + round(size * 0.035), coords[2], coords[3] + round(size * 0.035))
        draw.rounded_rectangle(shadow, radius=scaled_radius, fill=SHADOW)
    for rect, radius in GLYPH:
        coords, scaled_radius = transformed(rect, radius, size, maskable)
        draw.rounded_rectangle(coords, radius=scaled_radius, fill=WHITE)
    image.save(path)


def write_png_fallback(path: Path, size: int, maskable: bool) -> None:
    pixels = bytearray()
    for y in range(size):
        for x in range(size):
            pixels.extend(gradient_color(x, y, size))
    for rect, radius in GLYPH:
        coords, scaled_radius = transformed(rect, radius, size, maskable)
        shadow = (coords[0], coords[1] + round(size * 0.035), coords[2], coords[3] + round(size * 0.035))
        fill_round_rect_blend(pixels, size, shadow, scaled_radius, SHADOW)
    for rect, radius in GLYPH:
        coords, scaled_radius = transformed(rect, radius, size, maskable)
        fill_round_rect(pixels, size, coords, scaled_radius, WHITE)
    path.write_bytes(encode_png_rgba(size, size, pixels))


def gradient_color(x: int, y: int, size: int) -> tuple[int, int, int, int]:
    denom = max(1, 2 * (size - 1))
    t = (x + y) / denom
    if t < 0.46:
        base = lerp_color(BLUE, PINK, t / 0.46)
    else:
        base = lerp_color(PINK, ORANGE, (t - 0.46) / 0.54)

    # Add a broad teal glass wash without discrete decorative shapes.
    wash = max(0.0, 1.0 - ((x - size * 0.80) ** 2 + (y - size * 0.18) ** 2) ** 0.5 / (size * 0.72))
    if wash > 0:
        base = lerp_color(base, TEAL, min(0.34, wash * 0.34))

    shine = max(0.0, 1.0 - (x * 0.58 + y) / (size * 0.92))
    if shine > 0:
        base = lerp_color(base, WHITE, min(0.22, shine * 0.22))
    return base


def lerp_color(a: tuple[int, int, int, int], b: tuple[int, int, int, int], t: float) -> tuple[int, int, int, int]:
    t = max(0.0, min(1.0, t))
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(4))


def fill_round_rect(
    pixels: bytearray,
    size: int,
    rect: tuple[int, int, int, int],
    radius: int,
    color: tuple[int, int, int, int],
) -> None:
    x1, y1, x2, y2 = rect
    radius = min(radius, max(0, (x2 - x1) // 2), max(0, (y2 - y1) // 2))

    for y in range(max(0, y1), min(size, y2)):
        for x in range(max(0, x1), min(size, x2)):
            if inside_round_rect(x, y, x1, y1, x2, y2, radius):
                idx = (y * size + x) * 4
                pixels[idx : idx + 4] = bytes(color)


def fill_round_rect_blend(
    pixels: bytearray,
    size: int,
    rect: tuple[int, int, int, int],
    radius: int,
    color: tuple[int, int, int, int],
) -> None:
    x1, y1, x2, y2 = rect
    radius = min(radius, max(0, (x2 - x1) // 2), max(0, (y2 - y1) // 2))
    alpha = color[3] / 255
    for y in range(max(0, y1), min(size, y2)):
        for x in range(max(0, x1), min(size, x2)):
            if inside_round_rect(x, y, x1, y1, x2, y2, radius):
                idx = (y * size + x) * 4
                for channel in range(3):
                    pixels[idx + channel] = round(color[channel] * alpha + pixels[idx + channel] * (1 - alpha))
                pixels[idx + 3] = 255


def inside_round_rect(x: int, y: int, x1: int, y1: int, x2: int, y2: int, radius: int) -> bool:
    if radius <= 0:
        return True

    cx = min(max(x, x1 + radius), x2 - radius - 1)
    cy = min(max(y, y1 + radius), y2 - radius - 1)
    return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= radius * radius


def encode_png_rgba(width: int, height: int, pixels: bytes | bytearray) -> bytes:
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        row_start = y * stride
        raw.extend(pixels[row_start : row_start + stride])

    data = bytearray()
    data.extend(b"\x89PNG\r\n\x1a\n")
    data.extend(chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)))
    data.extend(chunk(b"IDAT", zlib.compress(bytes(raw), 9)))
    data.extend(chunk(b"IEND", b""))
    return bytes(data)


def chunk(kind: bytes, payload: bytes) -> bytes:
    return (
        struct.pack(">I", len(payload))
        + kind
        + payload
        + struct.pack(">I", binascii.crc32(kind + payload) & 0xFFFFFFFF)
    )


if __name__ == "__main__":
    main()
