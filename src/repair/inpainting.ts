/**
 * Inpainting providers. All pure (RGBAImage in, RGBAImage mutated in place)
 * so they are unit-testable and Photoshop-independent.
 *
 * DiffusionInpaintingProvider — classical boundary-diffusion inpainting
 * (iterative neighbour averaging seeded from the region border). This is the
 * same family as OpenCV's Navier–Stokes smoothing behaviour and is honest
 * about what it is: good for small, simple regions on flat or gradient
 * backgrounds. It is NOT OpenCV; opencv.js WASM Telea can be slotted in later
 * behind the same interface.
 *
 * DesignCoverProvider — style-matched cover panel: fills the region with a
 * vertical gradient sampled from the pixels directly above and below, so the
 * patch blends with the poster's existing background design.
 */
import type { RGBAImage, RectPx } from './rgba';
import { clampRect, sampleSurroundings, surroundingVariance } from './rgba';

export interface InpaintOutcome { provider: string; ok: boolean; message?: string }

export interface InpaintingProvider {
  readonly name: string;
  /** Can this provider produce acceptable quality for the given region? */
  suitable(img: RGBAImage, rect: RectPx): boolean;
  /** Repair the rect in place. */
  inpaint(img: RGBAImage, rect: RectPx): InpaintOutcome;
}

const MAX_DIFFUSION_AREA = 250 * 120; // beyond this, diffusion visibly blurs
const COMPLEXITY_LIMIT = 900;         // surrounding colour variance limit

export class DiffusionInpaintingProvider implements InpaintingProvider {
  readonly name = 'diffusion';

  suitable(img: RGBAImage, rect: RectPx): boolean {
    const r = clampRect(rect, img.width, img.height);
    return r.width * r.height <= MAX_DIFFUSION_AREA && surroundingVariance(img, r) <= COMPLEXITY_LIMIT;
  }

  inpaint(img: RGBAImage, rect: RectPx): InpaintOutcome {
    const r = clampRect(rect, img.width, img.height);
    if (!r.width || !r.height) return { provider: this.name, ok: false, message: 'empty rect' };
    const { data, width } = img;
    // seed interior with surrounding mean so iterations converge fast
    const [mr, mg, mb] = sampleSurroundings(img, r);
    for (let y = r.top; y < r.top + r.height; y++) for (let x = r.left; x < r.left + r.width; x++) {
      const i = (y * width + x) * 4;
      data[i] = mr; data[i + 1] = mg; data[i + 2] = mb; data[i + 3] = 255;
    }
    // iterative diffusion pulling boundary colours inward
    const iterations = Math.min(60, Math.max(12, Math.round(Math.max(r.width, r.height) / 2)));
    for (let it = 0; it < iterations; it++) {
      for (let y = r.top; y < r.top + r.height; y++) for (let x = r.left; x < r.left + r.width; x++) {
        const i = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          const up = y > 0 ? data[i - width * 4 + c] : data[i + c];
          const down = y < img.height - 1 ? data[i + width * 4 + c] : data[i + c];
          const left = x > 0 ? data[i - 4 + c] : data[i + c];
          const right = x < width - 1 ? data[i + 4 + c] : data[i + c];
          data[i + c] = (up + down + left + right) >> 2;
        }
      }
    }
    return { provider: this.name, ok: true };
  }
}

export class DesignCoverProvider implements InpaintingProvider {
  readonly name = 'design-cover';

  suitable(): boolean { return true; } // universal fallback — must never refuse

  inpaint(img: RGBAImage, rect: RectPx): InpaintOutcome {
    const r = clampRect(rect, img.width, img.height);
    if (!r.width || !r.height) return { provider: this.name, ok: false, message: 'empty rect' };
    const { data, width, height } = img;
    // sample rows just above and below the region for the gradient endpoints
    const rowMean = (y: number): [number, number, number] => {
      const yy = Math.max(0, Math.min(height - 1, y));
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let x = r.left; x < r.left + r.width; x += 2) {
        const i = (yy * width + x) * 4;
        sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; n++;
      }
      return n ? [sr / n, sg / n, sb / n] : [255, 255, 255];
    };
    const topC = rowMean(r.top - 3), botC = rowMean(r.top + r.height + 2);
    for (let y = 0; y < r.height; y++) {
      const t = r.height > 1 ? y / (r.height - 1) : 0;
      const cr = topC[0] + (botC[0] - topC[0]) * t;
      const cg = topC[1] + (botC[1] - topC[1]) * t;
      const cb = topC[2] + (botC[2] - topC[2]) * t;
      for (let x = 0; x < r.width; x++) {
        const i = ((r.top + y) * width + r.left + x) * 4;
        // feather 3px at the horizontal edges toward existing pixels
        const edge = Math.min(x, r.width - 1 - x);
        const a = edge >= 3 ? 1 : (edge + 1) / 4;
        data[i] = data[i] * (1 - a) + cr * a;
        data[i + 1] = data[i + 1] * (1 - a) + cg * a;
        data[i + 2] = data[i + 2] * (1 - a) + cb * a;
        data[i + 3] = 255;
      }
    }
    return { provider: this.name, ok: true };
  }
}

const PROVIDERS: InpaintingProvider[] = [new DiffusionInpaintingProvider(), new DesignCoverProvider()];

/**
 * Repair one rect with the best-suited provider, falling through the chain on
 * failure (mandated fallback: inpaint failure → design cover). Never throws.
 */
export function repairRect(img: RGBAImage, rect: RectPx): InpaintOutcome {
  let last: InpaintOutcome = { provider: 'none', ok: false, message: 'no provider ran' };
  for (const p of PROVIDERS) {
    if (!p.suitable(img, rect)) continue;
    try {
      last = p.inpaint(img, rect);
      if (last.ok) return last;
    } catch (err) {
      last = { provider: p.name, ok: false, message: String(err) };
    }
  }
  return last;
}
