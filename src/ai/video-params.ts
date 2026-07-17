export const VIDEO_RESOLUTIONS = ['720P', '1080P'] as const;
export const VIDEO_RATIOS = [
  '16:9',
  '9:16',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '1:1',
  '9:21',
  '21:9',
] as const;

export type VideoResolution = (typeof VIDEO_RESOLUTIONS)[number];
export type VideoRatio = (typeof VIDEO_RATIOS)[number];

export function normalizeVideoResolution(
  value?: string,
  fallback: VideoResolution = '720P',
): VideoResolution {
  const normalized = (value ?? fallback).trim().toUpperCase();
  return VIDEO_RESOLUTIONS.includes(normalized as VideoResolution)
    ? (normalized as VideoResolution)
    : fallback;
}

export function normalizeVideoRatio(
  value?: string,
  fallback: VideoRatio = '16:9',
): VideoRatio {
  const normalized = (value ?? fallback).trim();
  return VIDEO_RATIOS.includes(normalized as VideoRatio)
    ? (normalized as VideoRatio)
    : fallback;
}

export function normalizeVideoDuration(value?: number, fallback = 5): number {
  const duration = Number.isFinite(value) ? Math.round(value as number) : fallback;
  return Math.min(15, Math.max(3, duration));
}
