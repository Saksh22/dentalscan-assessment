import type { MutableRefObject } from "react";

import type { FrameAnalysisCanvas, GuideFeedback, GuideTone, GuideToneStyles } from "./types";

const MOTION_ALERT_THRESHOLD = 0.075;
const MOTION_SETTLING_THRESHOLD = 0.022;

export const DEFAULT_GUIDE_FEEDBACK: GuideFeedback = {
  tone: "medium",
  badge: "Camera starting",
  title: "Preparing mouth guide",
  detail: "Allow camera access to begin your guided scan.",
  hint: "The guide will center automatically once the video is ready.",
};

export const GUIDE_TONE_STYLES: Record<GuideTone, GuideToneStyles> = {
  low: {
    ring: "border-rose-400/80",
    innerRing: "border-rose-300/35",
    glow: "bg-rose-400/12 shadow-[0_0_80px_rgba(251,113,133,0.18)]",
    chip: "border-rose-400/25 bg-rose-500/15 text-rose-50",
    panel: "border-rose-400/20 bg-black/55 text-rose-50",
    pulse: "bg-rose-400",
  },
  medium: {
    ring: "border-amber-300/80",
    innerRing: "border-amber-200/35",
    glow: "bg-amber-300/10 shadow-[0_0_80px_rgba(252,211,77,0.16)]",
    chip: "border-amber-300/25 bg-amber-400/15 text-amber-50",
    panel: "border-amber-300/20 bg-black/55 text-amber-50",
    pulse: "bg-amber-300",
  },
  high: {
    ring: "border-emerald-300/85",
    innerRing: "border-emerald-200/35",
    glow: "bg-emerald-300/10 shadow-[0_0_80px_rgba(52,211,153,0.18)]",
    chip: "border-emerald-300/25 bg-emerald-400/15 text-emerald-50",
    panel: "border-emerald-300/20 bg-black/55 text-emerald-50",
    pulse: "bg-emerald-300",
  },
};

export function areGuideFeedbacksEqual(current: GuideFeedback | null, next: GuideFeedback) {
  if (!current) {
    return false;
  }

  return (
    current.tone === next.tone &&
    current.badge === next.badge &&
    current.title === next.title &&
    current.detail === next.detail &&
    current.hint === next.hint
  );
}

function getFrameAnalysisCanvas(ref: MutableRefObject<FrameAnalysisCanvas | null>) {
  if (ref.current) {
    return ref.current;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 36;
  canvas.height = 28;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return null;
  }

  ref.current = {
    canvas,
    context,
    previousSample: null,
    currentSample: new Uint8Array(canvas.width * canvas.height),
  };

  return ref.current;
}

export function sampleVideoMotion(
  video: HTMLVideoElement,
  canvasRef: MutableRefObject<FrameAnalysisCanvas | null>
) {
  const frameCanvas = getFrameAnalysisCanvas(canvasRef);

  if (!frameCanvas) {
    return null;
  }

  const { canvas, context, currentSample } = frameCanvas;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;

  for (let pixelIndex = 0; pixelIndex < currentSample.length; pixelIndex += 1) {
    const sourceIndex = pixelIndex * 4;
    currentSample[pixelIndex] = Math.round(
      imageData[sourceIndex] * 0.299 +
        imageData[sourceIndex + 1] * 0.587 +
        imageData[sourceIndex + 2] * 0.114
    );
  }

  const previousSample = frameCanvas.previousSample;
  frameCanvas.previousSample = currentSample;
  frameCanvas.currentSample = previousSample ?? new Uint8Array(currentSample.length);

  if (!previousSample) {
    return null;
  }

  let differenceSum = 0;

  for (let pixelIndex = 0; pixelIndex < currentSample.length; pixelIndex += 1) {
    differenceSum += Math.abs(currentSample[pixelIndex] - previousSample[pixelIndex]);
  }

  return differenceSum / currentSample.length / 255;
}

export function deriveGuideFeedback(params: {
  frameWidth: number;
  frameHeight: number;
  motionScore: number | null;
}) {
  const { frameWidth, frameHeight, motionScore } = params;

  if (frameWidth <= 0 || frameHeight <= 0) {
    return {
      tone: "medium" as const,
      badge: "Guide active",
      title: "Preparing stability guide",
      detail: "Allow the camera to finish loading before you capture.",
      hint: "The ring will react once the live feed is ready.",
    };
  }

  if (motionScore == null) {
    return {
      tone: "medium" as const,
      badge: "Calibrating",
      title: "Hold the camera naturally",
      detail: "We are sampling camera motion to estimate scan stability.",
      hint: "Pause briefly and the ring will settle into its color.",
    };
  }

  if (motionScore > MOTION_ALERT_THRESHOLD) {
    return {
      tone: "low" as const,
      badge: "Unstable",
      title: "Hold steady",
      detail: "There is too much camera movement for a reliable capture.",
      hint: "Pause your hands before taking the scan.",
    };
  }

  if (motionScore > MOTION_SETTLING_THRESHOLD) {
    return {
      tone: "medium" as const,
      badge: "Settling",
      title: "Almost steady",
      detail: "The camera is improving, but there is still some motion in the frame.",
      hint: "Wait for the ring to turn green before capturing.",
    };
  }

  return {
    tone: "high" as const,
    badge: "Stable",
    title: "Ready to capture",
    detail: "The camera is steady enough for a cleaner scan.",
    hint: "Take the shot while the ring stays green.",
  };
}
