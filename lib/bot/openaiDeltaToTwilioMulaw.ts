/**
 * OpenAI Realtime audio deltas are commonly base64 PCM16 little-endian mono (often 24 kHz).
 * Twilio Media Streams expect base64 raw G.711 μ-law @ 8 kHz mono.
 */

/** ITU-T G.711 μ-law encode for one 16-bit linear sample. */
export function pcm16SampleToMulaw(sample: number): number {
  const MULAW_MAX = 0x1fff;
  const MULAW_BIAS = 33;
  let s = Math.max(-32768, Math.min(32767, sample));
  let sign = (s >> 8) & 0x80;
  if (sign !== 0) s = -s;
  if (s > MULAW_MAX) s = MULAW_MAX;
  s += MULAW_BIAS;
  let exponent = 7;
  let expMask = 0x4000;
  while (exponent > 0 && (s & expMask) === 0) {
    exponent--;
    expMask >>= 1;
  }
  const mantissa = (s >> (exponent + 3)) & 0x0f;
  return (~(sign | (exponent << 4) | mantissa)) & 0xff;
}

function downsample24kTo8kPcm16(samples: Int16Array): Int16Array {
  const n = Math.floor(samples.length / 3);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const b = i * 3;
    out[i] = Math.round((samples[b] + samples[b + 1] + samples[b + 2]) / 3);
  }
  return out;
}

function pcm16ToMulawBuffer(samples: Int16Array): Buffer {
  const buf = Buffer.alloc(samples.length);
  for (let i = 0; i < samples.length; i++) {
    buf[i] = pcm16SampleToMulaw(samples[i]);
  }
  return buf;
}

/**
 * @param deltaBase64 — `response.audio.delta` / `response.output_audio.delta` `delta` field (base64 PCM16 LE).
 * @returns base64 μ-law 8 kHz payload for Twilio `media.payload`, or `null` if input is invalid.
 */
export function openAiAudioDeltaToTwilioMulawBase64(deltaBase64: string): string | null {
  const trimmed = deltaBase64.trim();
  if (!trimmed) return null;
  try {
    const raw = Buffer.from(trimmed, 'base64');
    if (raw.length < 6 || raw.length % 2 !== 0) return null;
    const pcm24k = new Int16Array(raw.buffer, raw.byteOffset, raw.length / 2);
    const pcm8k = downsample24kTo8kPcm16(pcm24k);
    const mulaw = pcm16ToMulawBuffer(pcm8k);
    return mulaw.toString('base64');
  } catch {
    return null;
  }
}

/** ITU-T G.711 μ-law byte → 16-bit linear (matches {@link pcm16SampleToMulaw} inverse). */
function mulawByteToLinear(u: number): number {
  const b = ~u & 0xff;
  const sign = b & 0x80;
  const exponent = (b >> 4) & 0x07;
  const mantissa = b & 0x0f;
  let sample = ((mantissa << 1) + 33) << exponent;
  sample -= 33;
  if (sign) {
    sample = -sample;
  }
  return Math.max(-32768, Math.min(32767, sample));
}

/** Nearest-neighbor ×3 upsample 8 kHz → 24 kHz (inverse of {@link downsample24kTo8kPcm16}). */
function upsample8kTo24kPcm16(samples8k: Int16Array): Int16Array {
  const out = new Int16Array(samples8k.length * 3);
  for (let i = 0; i < samples8k.length; i++) {
    const s = samples8k[i];
    const b = i * 3;
    out[b] = s;
    out[b + 1] = s;
    out[b + 2] = s;
  }
  return out;
}

/**
 * Twilio Media Streams: base64 raw μ-law @ 8 kHz mono → base64 PCM16 LE mono @ 24 kHz
 * for OpenAI Realtime `input_audio_buffer.append` when `session.audio.input.format` is PCM @ 24000.
 */
export function twilioMulaw8kBase64ToOpenAiRealtimePcm24MonoBase64(mulawBase64: string): string | null {
  const trimmed = mulawBase64.trim();
  if (!trimmed) return null;
  try {
    const mulaw = Buffer.from(trimmed, 'base64');
    if (mulaw.length < 1) return null;
    const pcm8 = new Int16Array(mulaw.length);
    for (let i = 0; i < mulaw.length; i++) {
      pcm8[i] = mulawByteToLinear(mulaw[i]);
    }
    const pcm24 = upsample8kTo24kPcm16(pcm8);
    return Buffer.from(pcm24.buffer, pcm24.byteOffset, pcm24.byteLength).toString('base64');
  } catch {
    return null;
  }
}
