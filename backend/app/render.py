"""Cinematic still renderer (Pillow)."""

from __future__ import annotations

import hashlib
import io
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

from app.models import Layout, MediaItem

CANVAS = (1920, 1080)


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for path in candidates:
        if Path(path).is_file():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def _hex_color(value: str) -> tuple[int, int, int, int]:
    raw = (value or "#ffffff").lstrip("#")
    if len(raw) == 6:
        r, g, b = int(raw[0:2], 16), int(raw[2:4], 16), int(raw[4:6], 16)
        return r, g, b, 255
    if len(raw) == 8:
        r, g, b, a = int(raw[0:2], 16), int(raw[2:4], 16), int(raw[4:6], 16), int(raw[6:8], 16)
        return r, g, b, a
    return 255, 255, 255, 255


def palette_for(title: str) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    digest = hashlib.sha256(title.encode("utf-8")).digest()
    a = (digest[0], digest[1], 40 + digest[2] % 80)
    b = (digest[3] % 60, digest[4] % 40, 20 + digest[5] % 50)
    return a, b


def synthetic_backdrop(title: str, size: tuple[int, int] = CANVAS) -> Image.Image:
    left, right = palette_for(title)
    image = Image.new("RGB", size, left)
    draw = ImageDraw.Draw(image)
    width, height = size
    for x in range(width):
        t = x / max(width - 1, 1)
        color = (
            int(left[0] * (1 - t) + right[0] * t),
            int(left[1] * (1 - t) + right[1] * t),
            int(left[2] * (1 - t) + right[2] * t),
        )
        draw.line([(x, 0), (x, height)], fill=color)
    overlay = Image.new("RGB", size, (8, 8, 12))
    image = Image.blend(image, overlay, 0.25)
    return image.filter(ImageFilter.GaussianBlur(radius=8))


def _load_image(path_or_bytes: str | Path | bytes | None, size: tuple[int, int]) -> Image.Image | None:
    if path_or_bytes is None:
        return None
    try:
        if isinstance(path_or_bytes, bytes):
            img = Image.open(io.BytesIO(path_or_bytes))
        else:
            p = Path(path_or_bytes)
            if not p.is_file():
                return None
            img = Image.open(p)
        img = img.convert("RGB")
        img.thumbnail((size[0] * 2, size[1] * 2), Image.Resampling.LANCZOS)
        # cover crop
        src_w, src_h = img.size
        target_w, target_h = size
        scale = max(target_w / src_w, target_h / src_h)
        resized = img.resize((int(src_w * scale), int(src_h * scale)), Image.Resampling.LANCZOS)
        left = (resized.width - target_w) // 2
        top = (resized.height - target_h) // 2
        return resized.crop((left, top, left + target_w, top + target_h))
    except Exception:
        return None


def apply_cinematic_fade(base: Image.Image, layout: Layout) -> Image.Image:
    width, height = base.size
    bg = layout.background
    if bg.brightness != 1.0:
        base = ImageEnhance.Brightness(base).enhance(max(0.2, min(1.6, bg.brightness)))
    shade = Image.new("L", (width, height), 0)
    px = shade.load()
    left = max(bg.fade_left, 0.0)
    right = max(bg.fade_right, 0.0)
    top = max(bg.fade_top, 0.0)
    bottom = max(bg.fade_bottom, 0.0)
    soft = max(bg.fade_softness, 0.05)
    for y in range(height):
        ny = y / max(height - 1, 1)
        for x in range(0, width, 4):
            nx = x / max(width - 1, 1)
            edge = 0.0
            if nx < left:
                edge = max(edge, (left - nx) / max(left, 0.001))
            if nx > 1 - right:
                edge = max(edge, (nx - (1 - right)) / max(right, 0.001))
            if ny < top:
                edge = max(edge, (top - ny) / max(top, 0.001))
            if ny > 1 - bottom:
                edge = max(edge, (ny - (1 - bottom)) / max(bottom, 0.001))
            alpha = min(1.0, edge ** (0.35 + soft))
            value = int(alpha * 210)
            for dx in range(4):
                if x + dx < width:
                    px[x + dx, y] = value
    color = Image.new("RGB", (width, height), _hex_color(bg.color)[:3])
    return Image.composite(color, base, shade)


def slot_text(item: MediaItem, slot: str, max_items: int | None = None) -> str:
    if slot == "title":
        return item.title
    if slot == "year":
        return str(item.year or "")
    if slot == "genres":
        names = item.genres[: max_items or 3]
        return "  ·  ".join(names)
    if slot == "runtime":
        return item.runtime
    if slot in ("rating", "primary_score"):
        return f"{item.rating:.1f}" if item.rating else ""
    if slot == "overview":
        return item.overview
    if slot in ("watch_status", "watch_state"):
        return (item.watch_state or "").replace("_", " ").title()
    if slot in ("source", "provider_source"):
        return (item.source or "").title()
    if slot == "age":
        return item.official_rating
    return ""


def render_still(
    item: MediaItem,
    layout: Layout,
    backdrop_bytes: bytes | None = None,
) -> Image.Image:
    size = (layout.canvas_width, layout.canvas_height)
    backdrop = _load_image(backdrop_bytes, size) or _load_image(item.backdrop_path, size)
    if backdrop is None:
        backdrop = synthetic_backdrop(item.title, size)
    canvas = apply_cinematic_fade(backdrop, layout)
    draw = ImageDraw.Draw(canvas, "RGBA")
    for layer in layout.layers:
        if not layer.visible:
            continue
        if layer.slot in ("backdrop",):
            continue
        if layer.slot == "poster" and item.poster_url:
            continue
        text = slot_text(item, layer.slot, layer.max_items)
        if not text:
            continue
        bold = layer.font_weight in ("bold", "black", "semibold")
        font = _font(layer.font_size, bold=bold)
        color = _hex_color(layer.color)
        x, y = int(layer.x), int(layer.y)
        max_width = int(layer.width or 0)
        if max_width and layer.slot == "overview":
            wrapped = _wrap(draw, text, font, max_width)
            text = "\n".join(wrapped[:4])
        # drop shadow
        draw.text((x + 2, y + 2), text, font=font, fill=(0, 0, 0, 180))
        draw.text((x, y), text, font=font, fill=color)
    return canvas.convert("RGB")


def _wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        bbox = draw.textbbox((0, 0), trial, font=font)
        if bbox[2] - bbox[0] <= max_width or not current:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def save_jpeg(image: Image.Image, dest: Path, quality: int = 90) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    image.save(dest, "JPEG", quality=quality, optimize=True)
    return dest
