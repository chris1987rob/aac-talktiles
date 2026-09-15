#!/usr/bin/env python3
"""Generate the Talk Tiles symbol set with Qwen-Image-2512 (+ Lightning 4-step LoRA)
running ComfyUI's nodes in-process on the RTX 3090.

Why in-process instead of the ComfyUI HTTP API: the 7B text encoder (9 GB) and the
20B transformer (20 GB) cannot share the 24 GB card, so a per-prompt workflow would
swap both models over PCIe for every image. Here every prompt is encoded first,
the encoder is released, and the transformer is loaded exactly once for the whole run.

Usage: gen_symbols.py [--only id,id,...] [--limit N] [--size 1024] [--force]
Outputs raw PNGs to symbol_gen/raw/<id>.png (skips ones that already exist).
"""
import os, sys, json, time, argparse, gc
HERE = os.path.dirname(os.path.abspath(__file__))
COMFY = "/home/mike/comfy"
sys.path.insert(0, COMFY)
os.chdir(COMFY)  # folder_paths resolves models/ relative to the ComfyUI root

ap = argparse.ArgumentParser()
ap.add_argument("--only", default="")
ap.add_argument("--limit", type=int, default=0)
ap.add_argument("--size", type=int, default=1024)
ap.add_argument("--steps", type=int, default=4)
ap.add_argument("--seed", type=int, default=20260913)
ap.add_argument("--force", action="store_true")
ap.add_argument("--out", default=os.path.join(HERE, "raw"))
ap.add_argument("--prompts", default=os.path.join(HERE, "prompts.json"))
args = ap.parse_args()

import torch
import numpy as np
from PIL import Image
import nodes
import comfy.model_management as mm
from comfy_extras.nodes_model_advanced import ModelSamplingAuraFlow

P = json.load(open(args.prompts))
prompts = P["prompts"]
ids = list(prompts)
if args.only:
    ids = [i for i in args.only.split(",") if i in prompts]
os.makedirs(args.out, exist_ok=True)
if not args.force:
    ids = [i for i in ids if not os.path.exists(os.path.join(args.out, i + ".png"))]
if args.limit:
    ids = ids[: args.limit]
print(f"{len(ids)} images to generate at {args.size}px, {args.steps} steps", flush=True)
if not ids:
    sys.exit(0)

# ---- 1. text encoder: encode everything, then drop it -----------------------
t0 = time.time()
clip = nodes.CLIPLoader().load_clip("qwen_2.5_vl_7b_fp8_scaled.safetensors", "qwen_image", "default")[0]
enc = nodes.CLIPTextEncode()
conds = {}
for n, sid in enumerate(ids, 1):
    conds[sid] = enc.encode(clip, prompts[sid])[0]
    if n % 25 == 0:
        print(f"  encoded {n}/{len(ids)}", flush=True)
# cfg 1.0 (Lightning) never evaluates the negative branch, but KSampler needs one.
neg = enc.encode(clip, "")[0]
print(f"encoded {len(ids)} prompts in {time.time()-t0:.0f}s", flush=True)
del clip, enc
mm.unload_all_models(); gc.collect(); torch.cuda.empty_cache()

# ---- 2. transformer + LoRA, loaded once -------------------------------------
t0 = time.time()
model = nodes.UNETLoader().load_unet("qwen_image_2512_fp8_e4m3fn.safetensors", "default")[0]
model = nodes.LoraLoaderModelOnly().load_lora_model_only(
    model, "Qwen-Image-2512-Lightning-4steps-V1.0-fp32.safetensors", 1.0)[0]
model = ModelSamplingAuraFlow().patch_aura(model, 3.1)[0]
vae = nodes.VAELoader().load_vae("qwen_image_vae.safetensors")[0]
sampler = nodes.KSampler()
decoder = nodes.VAEDecode()
print(f"model ready in {time.time()-t0:.0f}s", flush=True)

def empty_latent(size):
    # EmptySD3LatentImage: 16 latent channels at 1/8 resolution.
    return {"samples": torch.zeros([1, 16, size // 8, size // 8], device=mm.intermediate_device())}

t_run = time.time()
# ComfyUI's executor runs nodes under inference_mode; VAE.decode's in-place
# post-processing on an inference tensor fails without it.
def render(sid):
    latent = sampler.sample(model, args.seed, args.steps, 1.0, "euler", "simple",
                            conds[sid], neg, empty_latent(args.size), denoise=1.0)[0]
    img = decoder.decode(vae, latent)[0]          # [1, H, W, 3] float 0..1
    arr = (img[0].clamp(0, 1).cpu().numpy() * 255).round().astype(np.uint8)
    Image.fromarray(arr).save(os.path.join(args.out, sid + ".png"))

with torch.inference_mode():
    for n, sid in enumerate(ids, 1):
        t1 = time.time()
        render(sid)
        dt = time.time() - t1
        done = n; left = len(ids) - n
        eta = (time.time() - t_run) / done * left
        print(f"[{done}/{len(ids)}] {sid} {dt:.1f}s  eta {eta/60:.0f} min", flush=True)
print("ALL DONE", flush=True)
