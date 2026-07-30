# Image generation

**What it is:** creating a brand-new image from a text description — "a photorealistic Dubai skyline at golden hour" — using a generative model.

## Why it matters for an AI Engineer

Image generation powers a whole class of products: marketing creative at scale, product mockups, ad variations, avatars, game assets, design tools. For an AI Engineer it's a distinct skill from text LLMs — different models (diffusion, not autoregressive), different controls (prompts *plus* reference images, masks, styles), and different failure modes (garbled hands, unwanted text, style drift). Even if you never train one, you'll be asked to *integrate* generation — call the API, control the output, moderate it, manage the per-image cost — into a product.

## The mechanism / how it works

Most image generators are **diffusion models**, and the idea is beautifully counterintuitive:

1. **Training — learn to denoise.** Take a real image, add a little random noise, and train a model to remove it. Repeat across many noise levels until the model can turn *pure static* back into a coherent image, step by step.
2. **Generation — denoise from noise.** Start with a canvas of random noise. The model removes noise a bit at a time (20–50 steps), each step nudging the pixels toward "looks like a real image."
3. **Text conditioning.** Your prompt is encoded (via a text encoder like CLIP/T5) and injected at every denoising step, steering *what* emerges — so it denoises toward "a cat", not just any image.
4. **Latent diffusion (the efficiency trick).** Doing this on full-resolution pixels is slow. Stable Diffusion does it in a compressed **latent space** (small numeric grid), then decodes to pixels at the end — far cheaper.

Beyond the prompt, you get control knobs: **negative prompts** ("no text, no extra fingers"), **image-to-image** (start from a reference instead of noise), **inpainting** (regenerate only a masked region — swap a background, remove an object), and **guidance scale** (how strictly to follow the prompt vs. stay natural).

<div class="diagram">
  <div class="flow">
    <span class="dbox gray">🌫️ random noise</span>
    <span class="darr">→<span class="lbl">step 1</span></span>
    <span class="dbox orange">blurry shape</span>
    <span class="darr">→<span class="lbl">…20–50 steps</span></span>
    <span class="dbox orange">clearer</span>
    <span class="darr">→</span>
    <span class="dbox green">🎨 final image</span>
  </div>
  <div class="dcap">Diffusion turns noise into an image step by step, steered by your text prompt at every step.</div>
</div>

## Concrete example

Hosted generation (OpenAI `gpt-image-1`, 2026):

```python
from openai import OpenAI
import base64
client = OpenAI()

img = client.images.generate(
    model="gpt-image-1",
    prompt="A sleek electric SUV parked in front of the Dubai Frame at dusk, "
           "cinematic lighting, photorealistic, no text, no watermark",
    size="1024x1024",
    quality="high",
)
with open("ad.png", "wb") as f:
    f.write(base64.b64decode(img.data[0].b64_json))
```

Open, self-hosted (Stable Diffusion via `diffusers`) gives full control and zero per-image API cost:

```python
from diffusers import DiffusionPipeline
import torch
pipe = DiffusionPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0", torch_dtype=torch.float16).to("cuda")
image = pipe(prompt="Dubai skyline at golden hour, ultra detailed",
             negative_prompt="text, watermark, blurry", num_inference_steps=30).images[0]
image.save("skyline.png")
```

## How a company uses this

> A **Dubai e-commerce marketplace** generates lifestyle product imagery at scale — instead of a photoshoot for every listing, they use **image-to-image + inpainting** to place a product into varied realistic scenes and generate localized ad variants (Ramadan themes, seasonal backgrounds). Scale: tens of thousands of images/month. Economics: a studio photoshoot runs hundreds of dirhams per product; a generated variant costs ~$0.02–0.08 (hosted) or GPU-seconds (self-hosted). At volume they self-host SDXL on their own GPUs to kill per-image cost and keep brand style consistent via fine-tuned models/LoRAs. Two production controls are mandatory: a **safety/moderation filter** (generation can produce off-brand or NSFW output — you must screen before publishing) and **brand-consistency** guardrails so outputs match their look. Regenerating hands and any embedded text remains the reliability weak spot.

## Common mistakes / misconceptions

- **Thinking it's an LLM.** Diffusion works by denoising, not next-token prediction — different model, different controls entirely.
- **Prompt-only mindset.** Negative prompts, image-to-image, inpainting, and guidance scale give far more control than the prompt alone.
- **Skipping moderation.** Generative models can produce unsafe or off-brand images. Always filter output before it goes public.
- **Expecting perfect text/hands.** Rendering legible text and correct hands is still shaky — don't rely on it for logos or signage.

## Interview tip
Say: *"Image generators are diffusion models — trained to denoise, they turn random noise into an image over ~30 steps, steered by the text prompt at each step; latent diffusion does it in compressed space for speed. Beyond the prompt I control output with negative prompts, image-to-image, and inpainting, self-host SDXL at volume to kill per-image cost, and always run a moderation filter before publishing."* The denoising mechanism plus the control knobs and moderation gate show real depth.
