#!/usr/bin/env python3
"""Clock faces the diffusion model cannot do (it draws every clock at ~10:10).
Drawn to match the generated set: thick dark outline, flat fills, 1024px white
background, then fed through postprocess.py like any other raw picture."""
import math, os
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
INK = (28, 34, 51); FACE = (255, 248, 235); RIM = (70, 150, 220); RED = (230, 70, 70)
S = 1024; SS = 4  # supersample for smooth edges

def clock(hour, minute):
    W = S * SS
    im = Image.new("RGB", (W, W), "white"); d = ImageDraw.Draw(im)
    c = W // 2; r = int(W * 0.44); lw = int(W * 0.028)
    d.ellipse([c-r, c-r, c+r, c+r], fill=RIM, outline=INK, width=lw)
    r2 = int(r * 0.84)
    d.ellipse([c-r2, c-r2, c+r2, c+r2], fill=FACE, outline=INK, width=lw)
    for i in range(12):  # hour ticks, the four quarters bolder
        a = math.radians(i * 30 - 90); big = i % 3 == 0
        r_in = r2 * (0.80 if big else 0.87); r_out = r2 * 0.94
        d.line([c + r_in*math.cos(a), c + r_in*math.sin(a), c + r_out*math.cos(a), c + r_out*math.sin(a)],
               fill=INK, width=int(lw * (1.4 if big else 0.8)))
    def hand(angle_deg, length, width, color):
        a = math.radians(angle_deg - 90)
        d.line([c, c, c + length*math.cos(a), c + length*math.sin(a)], fill=color, width=width)
        d.ellipse([c + length*math.cos(a) - width/2, c + length*math.sin(a) - width/2,
                   c + length*math.cos(a) + width/2, c + length*math.sin(a) + width/2], fill=color)
    hand((hour % 12) * 30 + minute * 0.5, r2 * 0.50, int(lw * 2.2), INK)   # hour hand
    hand(minute * 6, r2 * 0.74, int(lw * 1.5), RED)                          # minute hand
    d.ellipse([c-lw*1.6, c-lw*1.6, c+lw*1.6, c+lw*1.6], fill=INK)
    return im.resize((S, S), Image.LANCZOS)

faces = {f"clock_{h}": (h, 0) for h in range(1, 13)}
faces["o_clock"] = (3, 0); faces["half_past"] = (3, 30); faces["clock"] = (10, 10)
for sid, (h, m) in faces.items():
    clock(h, m).save(os.path.join(HERE, "raw", sid + ".png"))
print("drew", len(faces))
