export type ScanView = {
  label: string;
  instruction: string;
};

export type GuideTone = "low" | "medium" | "high";

export type GuideFeedback = {
  tone: GuideTone;
  badge: string;
  title: string;
  detail: string;
  hint: string;
};

export type GuideToneStyles = {
  ring: string;
  innerRing: string;
  glow: string;
  chip: string;
  panel: string;
  pulse: string;
};

export type FrameAnalysisCanvas = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  previousSample: Uint8Array | null;
  currentSample: Uint8Array;
};

export type SubmissionState = "idle" | "uploading" | "success" | "error";

export type NotificationInfo = {
  id: string;
  read: boolean;
};
