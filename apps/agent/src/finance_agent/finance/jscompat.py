"""Aritmética "como JavaScript" para que Python dé exactamente los mismos montos.

El dataset y la analítica se portaron desde TypeScript (apps/web). Para que el
modo servidor muestre las MISMAS cifras que el modo local hay que imitar tres
detalles de JS que Python hace distinto:

- `Math.round` redondea los empates hacia +∞ (Python `round` usa banker's rounding).
- `Array.reduce((s, x) => s + x)` suma en orden y sin compensar; desde Python 3.12
  `sum()` de floats usa suma compensada y puede dar otro último decimal.
- `${n}` imprime `84` y no `84.0`.

Y el generador del historial usa enteros de 32 bits (`Math.imul`, `>>>`).
"""

from __future__ import annotations

import math
from collections.abc import Iterable

_U32 = 0xFFFFFFFF


def js_round(x: float) -> int:
    """`Math.round`: entero más cercano; los empates van hacia +∞."""
    floor = math.floor(x)
    return int(floor + 1 if x - floor >= 0.5 else floor)


def round2(x: float) -> float:
    """`Math.round(n * 100) / 100` (el redondeo a centavos del front)."""
    return js_round(x * 100) / 100


def js_sum(values: Iterable[float]) -> float:
    """Suma en orden, sin compensación (igual que `reduce` en JS)."""
    total = 0.0
    for value in values:
        total += value
    return total


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def js_str(value: float | int) -> str:
    """Número → texto como en un template string de JS (`84`, `212.19`)."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float):
        if math.isfinite(value) and value.is_integer():
            return str(int(value))
        return repr(value)
    return str(value)


def to_num(value: object) -> float | None:
    """`toNum` del front: acepta números y strings numéricos; el resto → None."""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return None if isinstance(value, float) and math.isnan(value) else float(value)
    if isinstance(value, str):
        text = value.strip()
        if text == "":
            return 0.0  # Number('') === 0 en JS
        try:
            number = float(text)
        except ValueError:
            return None
        return None if math.isnan(number) else number
    return None


# ─── Enteros de 32 bits (PRNG y hash del historial) ─────────────────────────


def _u32(x: int) -> int:
    return x & _U32


def _i32(x: int) -> int:
    x &= _U32
    return x - 0x1_0000_0000 if x & 0x8000_0000 else x


def _imul(a: int, b: int) -> int:
    """`Math.imul`: producto de 32 bits con signo."""
    return _i32(_u32(a) * _u32(b))


def _ushr(x: int, bits: int) -> int:
    """`x >>> bits`."""
    return _u32(x) >> bits


def fnv1a(text: str) -> int:
    """Hash FNV-1a de 32 bits (`hashString` del front)."""
    h = 2166136261
    for char in text:
        h = _i32(h) ^ ord(char)
        h = _imul(h, 16777619)
    return _u32(h)


class Mulberry32:
    """PRNG `mulberry32` del front: misma semilla → misma secuencia."""

    def __init__(self, seed: int) -> None:
        self._a = _u32(seed)

    def __call__(self) -> float:
        self._a = _i32(self._a + 0x6D2B79F5)
        a = self._a
        t = _imul(a ^ _ushr(a, 15), 1 | a)
        t = _i32(_i32(t + _imul(t ^ _ushr(t, 7), 61 | t)) ^ t)
        return _u32(t ^ _ushr(t, 14)) / 4294967296
