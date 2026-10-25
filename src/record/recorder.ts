// 15-second recording (docs/02 §6.2, docs/03 §10). Each engine frame is
// composited onto a 2D canvas together with the things that must be in the
// video but are not in the WebGL canvas: the seal watermark and the words
// rising from the input. The composite canvas is what MediaRecorder sees,
// so UI controls and the 录制中 badge never end up in the file.

export const RECORD_SECONDS = 15;
const MAX_EDGE = 1080;
const FPS = 30;

const MIME_CANDIDATES: { type: string; bitrate: number; ext: 'mp4' | 'webm' }[] = [
  { type: 'video/mp4;codecs=avc1.42E01E', bitrate: 6_000_000, ext: 'mp4' },
  { type: 'video/mp4', bitrate: 6_000_000, ext: 'mp4' },
  { type: 'video/webm;codecs=vp9', bitrate: 5_000_000, ext: 'webm' },
  { type: 'video/webm;codecs=vp8', bitrate: 5_000_000, ext: 'webm' },
  { type: 'video/webm', bitrate: 5_000_000, ext: 'webm' },
];

// With sound on, the same order with an audio codec named; a browser that
// cannot encode audio in either container still records, silently.
const MIME_WITH_AUDIO: { type: string; bitrate: number; ext: 'mp4' | 'webm' }[] = [
  { type: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', bitrate: 6_000_000, ext: 'mp4' },
  { type: 'video/webm;codecs=vp9,opus', bitrate: 5_000_000, ext: 'webm' },
  { type: 'video/webm;codecs=vp8,opus', bitrate: 5_000_000, ext: 'webm' },
];

export interface Format {
  type: string;
  bitrate: number;
  ext: 'mp4' | 'webm';
  audio: boolean;
}

export function pickFormat(isSupported: (t: string) => boolean, withAudio = false): Format | null {
  const audio = withAudio ? MIME_WITH_AUDIO.find((c) => isSupported(c.type)) : undefined;
  if (audio) return { ...audio, audio: true };
  const video = MIME_CANDIDATES.find((c) => isSupported(c.type));
  return video ? { ...video, audio: false } : null;
}

export function canRecord(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
    pickFormat((t) => MediaRecorder.isTypeSupported(t)) !== null
  );
}

export const isWeChat = (): boolean => /MicroMessenger/i.test(navigator.userAgent);

/** Output size: the canvas's own pixels, scaled so the long edge is at most 1080. */
export function outputSize(w: number, h: number): { width: number; height: number } {
  const k = Math.min(1, MAX_EDGE / Math.max(w, h, 1));
  // Even dimensions keep H.264 encoders happy.
  const even = (n: number) => Math.max(2, Math.round((n * k) / 2) * 2);
  return { width: even(w), height: even(h) };
}

export interface Take {
  blob: Blob;
  url: string;
  ext: 'mp4' | 'webm' | 'png';
  seconds: number;
}

/** Draws one engine frame plus overlays into a 2D canvas of the output size. */
export class Compositor {
  readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private readonly scale: number;

  constructor(source: HTMLCanvasElement) {
    const { width, height } = outputSize(source.width, source.height);
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d')!;
    // CSS pixels → output pixels, for the DOM overlays.
    this.scale = width / Math.max(source.clientWidth, 1);
  }

  draw(source: HTMLCanvasElement): void {
    const { ctx, canvas } = this;
    ctx.globalAlpha = 1;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    this.drawWords(source);
    this.drawSeal();
  }

  /** The words rising from the input are DOM spans; copy what is on screen. */
  private drawWords(source: HTMLCanvasElement): void {
    const spans = document.querySelectorAll<HTMLElement>('.flight span');
    if (!spans.length) return;
    const { ctx, scale } = this;
    const origin = source.getBoundingClientRect();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 12 * scale;
    for (const el of spans) {
      const style = getComputedStyle(el);
      const opacity = parseFloat(style.opacity);
      if (!(opacity > 0.01)) continue;
      const r = el.getBoundingClientRect();
      // The rect grows and shrinks with the span's own scale transform.
      const size = parseFloat(style.fontSize) * Math.min(r.height / Math.max(el.offsetHeight, 1), 1);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = style.color;
      ctx.font = `${size * scale}px ${style.fontFamily}`;
      ctx.fillText(el.textContent ?? '', (r.left + r.width / 2 - origin.left) * scale, (r.top + r.height / 2 - origin.top) * scale);
    }
    ctx.restore();
  }

  /** A small cinnabar seal, bottom right (docs/03 §3.1 朱砂 · 印章水印). */
  private drawSeal(): void {
    const { ctx, canvas } = this;
    const s = Math.round(Math.min(canvas.width, canvas.height) * 0.06);
    const m = Math.round(s * 0.6);
    const x = canvas.width - m - s;
    const y = canvas.height - m - s;
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = '#C8553D';
    const r = s * 0.12;
    ctx.beginPath();
    ctx.roundRect(x, y, s, s, r);
    ctx.fill();
    // Paper-coloured characters, not a cut-out: video encoders drop alpha.
    ctx.fillStyle = '#EFEADF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${s * 0.4}px 'Kaiti SC', 'STKaiti', 'KaiTi', serif`;
    ctx.fillText('万', x + s * 0.5, y + s * 0.29);
    ctx.fillText('象', x + s * 0.5, y + s * 0.72);
    ctx.restore();
  }

  snapshot(): Promise<Blob> {
    return new Promise((resolve, reject) =>
      this.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'),
    );
  }
}

/** One recording: feed it frames, stop it (or let it run out), get a Take. */
export class Recording {
  readonly compositor: Compositor;
  private readonly recorder: MediaRecorder;
  private readonly chunks: Blob[] = [];
  private readonly format: Format;
  private readonly startedAt = performance.now();
  private readonly done: Promise<Take>;

  /** `audio`: what the sound is playing (src/sound.ts), or null for a silent take. */
  constructor(source: HTMLCanvasElement, audio: MediaStream | null = null) {
    this.format = pickFormat((t) => MediaRecorder.isTypeSupported(t), !!audio)!;
    this.compositor = new Compositor(source);
    this.compositor.draw(source);
    const video = this.compositor.canvas.captureStream(FPS);
    const stream =
      audio && this.format.audio ? new MediaStream([...video.getVideoTracks(), ...audio.getAudioTracks()]) : video;
    this.recorder = new MediaRecorder(stream, { mimeType: this.format.type, videoBitsPerSecond: this.format.bitrate });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size) this.chunks.push(e.data);
    };
    this.done = new Promise((resolve) => {
      this.recorder.onstop = () => {
        // Only our own canvas track: the audio track belongs to the live sound.
        for (const t of video.getTracks()) t.stop();
        const blob = new Blob(this.chunks, { type: this.format.type.split(';')[0] });
        resolve({ blob, url: URL.createObjectURL(blob), ext: this.format.ext, seconds: this.elapsed });
      };
    });
    this.recorder.start(1000);
  }

  get elapsed(): number {
    return Math.min((performance.now() - this.startedAt) / 1000, RECORD_SECONDS);
  }

  frame(source: HTMLCanvasElement): void {
    if (this.recorder.state === 'recording') this.compositor.draw(source);
  }

  stop(): Promise<Take> {
    if (this.recorder.state !== 'inactive') this.recorder.stop();
    return this.done;
  }
}

export async function saveTake(take: Take): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const name = `wonderful-world-${stamp}.${take.ext}`;
  const file = new File([take.blob], name, { type: take.blob.type });
  // Phones: the share sheet can put the video straight into the photo library.
  const touch = window.matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = take.url;
  a.download = name;
  a.click();
  return 'downloaded';
}
