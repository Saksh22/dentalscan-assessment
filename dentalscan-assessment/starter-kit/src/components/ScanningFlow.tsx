"use client";

import React, { memo, useState, useRef, useCallback, useEffect } from "react";
import { Camera, RefreshCw, CheckCircle2 } from "lucide-react";
import QuickMessageSidebar from "@/components/QuickMessageSidebar";

/**
 * CHALLENGE: SCAN ENHANCEMENT
 * 
 * Your goal is to improve the User Experience of the Scanning Flow.
 * 1. Implement a Visual Guidance Overlay (e.g., a circle or mouth outline) on the video feed.
 * 2. Add real-time feedback to the user (e.g., "Face not centered", "Move closer").
 * 3. Ensure the UI feels premium and responsive.
 */

const DEMO_PATIENT_ID = "patient-demo";
const VIEWS = [
  { label: "Front View", instruction: "Smile and look straight at the camera." },
  { label: "Left View", instruction: "Turn your head to the left." },
  { label: "Right View", instruction: "Turn your head to the right." },
  { label: "Upper Teeth", instruction: "Tilt your head back and open wide." },
  { label: "Lower Teeth", instruction: "Tilt your head down and open wide." },
] as const;

type GuideTone = "low" | "medium" | "high";

type GuideFeedback = {
  tone: GuideTone;
  badge: string;
  title: string;
  detail: string;
  hint: string;
};

type FrameAnalysisCanvas = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  previousSample: Uint8Array | null;
  currentSample: Uint8Array;
};

const DEFAULT_GUIDE_FEEDBACK: GuideFeedback = {
  tone: "medium",
  badge: "Camera starting",
  title: "Preparing mouth guide",
  detail: "Allow camera access to begin your guided scan.",
  hint: "The guide will center automatically once the video is ready.",
};

const GUIDE_TONE_STYLES: Record<
  GuideTone,
  {
    ring: string;
    innerRing: string;
    glow: string;
    chip: string;
    panel: string;
    pulse: string;
  }
> = {
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

function areGuideFeedbacksEqual(current: GuideFeedback | null, next: GuideFeedback) {
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

function getFrameAnalysisCanvas(ref: React.MutableRefObject<FrameAnalysisCanvas | null>) {
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

function sampleVideoMotion(
  video: HTMLVideoElement,
  canvasRef: React.MutableRefObject<FrameAnalysisCanvas | null>
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

function deriveGuideFeedback(params: {
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

  if (motionScore > 0.075) {
    return {
      tone: "low" as const,
      badge: "Unstable",
      title: "Hold steady",
      detail: "There is too much camera movement for a reliable capture.",
      hint: "Pause your hands before taking the scan.",
    };
  }

  if (motionScore > 0.022) {
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

const GuidanceOverlay = memo(function GuidanceOverlay({
  feedback,
  viewLabel,
}: {
  feedback: GuideFeedback;
  viewLabel: string;
}) {
  const toneStyles = GUIDE_TONE_STYLES[feedback.tone];

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_0%,rgba(0,0,0,0)_28%,rgba(0,0,0,0.26)_56%,rgba(0,0,0,0.68)_100%)]" />

      <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
        <div className="rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-200 backdrop-blur">
          {viewLabel}
        </div>
        <div className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${toneStyles.chip}`}>
          {feedback.badge}
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="relative flex w-full max-w-[clamp(14rem,68vw,24rem)] items-center justify-center">
          <div
            className={`absolute h-[clamp(12rem,54vw,20rem)] w-[clamp(12rem,54vw,20rem)] rounded-full blur-3xl transition-all duration-300 ${toneStyles.glow}`}
          />
          <div
            className={`relative aspect-[4/5] w-[clamp(12rem,60vw,18rem)] rounded-[45%] border-[3px] transition-all duration-300 ${toneStyles.ring}`}
          >
            <div className={`absolute inset-[9%] rounded-[45%] border border-dashed transition-all duration-300 ${toneStyles.innerRing}`} />
            <div className="absolute left-1/2 top-1/2 h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-[48%] border border-white/10" />
          </div>
        </div>
      </div>

    </div>
  );
});

const ActiveScanViewport = memo(function ActiveScanViewport({
  videoRef,
  camReady,
  instruction,
  viewLabel,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  camReady: boolean;
  instruction: string;
  viewLabel: string;
}) {
  const frameAnalysisCanvasRef = useRef<FrameAnalysisCanvas | null>(null);
  const smoothedMotionScoreRef = useRef<number | null>(null);
  const lastGuideFeedbackRef = useRef<GuideFeedback | null>(DEFAULT_GUIDE_FEEDBACK);
  const [guideFeedback, setGuideFeedback] = useState<GuideFeedback>(DEFAULT_GUIDE_FEEDBACK);

  useEffect(() => {
    if (!camReady) {
      return;
    }

    let isCancelled = false;
    let timeoutId: number | undefined;

    const analyzeFrame = () => {
      if (isCancelled) {
        return;
      }

      const video = videoRef.current;

      if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        timeoutId = window.setTimeout(analyzeFrame, 300);
        return;
      }

      const videoMotionScore = sampleVideoMotion(video, frameAnalysisCanvasRef);

      if (videoMotionScore != null) {
        smoothedMotionScoreRef.current =
          smoothedMotionScoreRef.current == null
            ? videoMotionScore
            : smoothedMotionScoreRef.current * 0.58 + videoMotionScore * 0.42;
      }

      const nextGuideFeedback = deriveGuideFeedback({
        frameWidth: video.videoWidth,
        frameHeight: video.videoHeight,
        motionScore: smoothedMotionScoreRef.current,
      });

      if (!areGuideFeedbacksEqual(lastGuideFeedbackRef.current, nextGuideFeedback)) {
        lastGuideFeedbackRef.current = nextGuideFeedback;
        setGuideFeedback(nextGuideFeedback);
      }

      // Keep analysis infrequent so the media feed stays responsive.
      timeoutId = window.setTimeout(analyzeFrame, 420);
    };

    analyzeFrame();

    return () => {
      isCancelled = true;
      smoothedMotionScoreRef.current = null;
      lastGuideFeedbackRef.current = DEFAULT_GUIDE_FEEDBACK;
      frameAnalysisCanvasRef.current = null;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [camReady, videoRef, viewLabel]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />

      <GuidanceOverlay feedback={guideFeedback} viewLabel={viewLabel} />

      <div className="absolute bottom-10 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent text-center">
        <p className="text-sm font-medium">
          {instruction}{" "}
          <span className={`font-semibold ${GUIDE_TONE_STYLES[guideFeedback.tone].chip.split(" ").at(-1)}`}>
            {guideFeedback.badge.toLowerCase()}.
          </span>
        </p>
      </div>
    </>
  );
});

export default function ScanningFlow() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camReady, setCamReady] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [submissionState, setSubmissionState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [submissionMessage, setSubmissionMessage] = useState("Uploading results...");
  const [isRefreshingNotification, setIsRefreshingNotification] = useState(false);
  const [isNotificationLive, setIsNotificationLive] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);
  const [notificationInfo, setNotificationInfo] = useState<{
    id: string;
    read: boolean;
  } | null>(null);

  // Initialize Camera
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCamReady(true);
        }
      } catch (err) {
        console.error("Camera access denied", err);
      }
    }
    startCamera();
  }, []);

  const handleCapture = useCallback(() => {
    // Boilerplate logic for capturing a frame from the video feed
    const video = videoRef.current;
    if (!video || currentStep >= VIEWS.length) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg");
      setCapturedImages((prev) => [...prev, dataUrl]);
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep, VIEWS.length]);

  const submitScan = useCallback(async () => {
    setSubmissionState("uploading");
    setSubmissionMessage("Uploading results...");
    setNotificationInfo(null);
    setScanId(null);

    try {
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          images: capturedImages,
          userId: "clinic-demo",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Upload failed");
      }

      setSubmissionState("success");
      setScanId(data.scanId);
      setSubmissionMessage("The Clinic has been notified and someone will join the telehealth room soon.");
      setNotificationInfo({
        id: data.notificationId,
        read: Boolean(data.notificationRead),
      });
    } catch (error) {
      console.error("Scan submission failed:", error);
      setSubmissionState("error");
      setSubmissionMessage("Upload failed. Retry to resend the completed scan.");
    }
  }, [capturedImages]);

  useEffect(() => {
    if (
      currentStep === VIEWS.length &&
      capturedImages.length === VIEWS.length &&
      submissionState === "idle"
    ) {
      void submitScan();
    }
  }, [capturedImages.length, currentStep, submitScan, submissionState, VIEWS.length]);

  const refreshNotificationStatus = useCallback(async (options?: { silent?: boolean }) => {
    if (!notificationInfo?.id) {
      return;
    }

    if (!options?.silent) {
      setIsRefreshingNotification(true);
    }

    try {
      const response = await fetch(
        `/api/notify?notificationId=${encodeURIComponent(notificationInfo.id)}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (!data?.notification) {
        return;
      }

      setNotificationInfo((current) => {
        if (!current || current.id !== data.notification.id) {
          return current;
        }

        return {
          ...current,
          read: Boolean(data.notification.read),
        };
      });
    } catch (error) {
      console.error("Notification refresh failed:", error);
    } finally {
      if (!options?.silent) {
        setIsRefreshingNotification(false);
      }
    }
  }, [notificationInfo?.id]);

  useEffect(() => {
    if (!notificationInfo?.id) {
      setIsNotificationLive(false);
      return;
    }

    const searchParams = new URLSearchParams({
      notificationId: notificationInfo.id,
    });
    const eventSource = new EventSource(`/api/notify/stream?${searchParams.toString()}`);

    eventSource.addEventListener("connected", () => {
      setIsNotificationLive(true);
    });

    eventSource.addEventListener("notification", (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          id: string;
          read: boolean;
        };

        setNotificationInfo((current) => {
          if (!current || current.id !== payload.id) {
            return current;
          }

          return {
            ...current,
            read: Boolean(payload.read),
          };
        });
      } catch (error) {
        console.error("Notification stream parse failed:", error);
      }
    });

    eventSource.onerror = () => {
      setIsNotificationLive(false);
    };

    return () => {
      setIsNotificationLive(false);
      eventSource.close();
    };
  }, [notificationInfo?.id]);

  useEffect(() => {
    if (!notificationInfo?.id) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshNotificationStatus({ silent: true });
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [notificationInfo?.id, refreshNotificationStatus]);

  return (
    <div className="flex flex-col items-center bg-black min-h-screen text-white">
      {/* Header */}
      <div className="p-4 w-full bg-zinc-900 border-b border-zinc-800 flex justify-between">
        <h1 className="font-bold text-blue-400">DentalScan AI</h1>
        <span className="text-xs text-zinc-500">Step {Math.min(currentStep + 1, VIEWS.length)}/5</span>
      </div>

      {/* Main Viewport */}
      <div
        className={`relative w-full overflow-hidden bg-zinc-950 ${
          currentStep < 5
            ? "max-w-md aspect-[3/4] flex items-center justify-center"
            : "max-w-6xl min-h-[42rem]"
        }`}
      >
        {currentStep < 5 ? (
          <ActiveScanViewport
            videoRef={videoRef}
            camReady={camReady}
            instruction={VIEWS[currentStep].instruction}
            viewLabel={VIEWS[currentStep].label}
          />
        ) : (
          <div className="flex h-full flex-col gap-6 p-4 md:p-6">
            <div className={`flex h-full flex-col gap-6 ${submissionState === "success" ? "xl:flex-row" : ""}`}>
              <div className="flex-1 rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900 p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                <CheckCircle2
                  size={48}
                  className={`mx-auto mb-4 ${submissionState === "error" ? "text-amber-500" : "text-green-500"}`}
                />
                <h2 className="text-xl font-bold">Scan Complete</h2>
                <p className="mt-2 text-zinc-400">{submissionMessage}</p>
                {submissionState === "uploading" && (
                  <RefreshCw size={18} className="mx-auto mt-4 animate-spin text-blue-400" />
                )}
                {scanId && (
                  <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-white/8 bg-white/5 p-4 text-left">
                    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                      Scan ID
                    </p>
                    <p className="mt-2 break-all font-mono text-sm text-blue-200">{scanId}</p>
                  </div>
                )}
                {notificationInfo && (
                  <div className="mx-auto mt-6 max-w-xl rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-950 p-5 text-left shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-blue-300/90">
                          Clinic Alert
                        </p>
                        <h3 className="mt-2 text-base font-semibold text-white">
                          Scan completion notification sent.
                        </h3>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                            notificationInfo.read
                              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                              : "border-amber-400/30 bg-amber-400/10 text-amber-300"
                          }`}
                        >
                          {notificationInfo.read ? "Read" : "Unread"}
                        </span>
                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium ${
                            isNotificationLive
                              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                              : "border-zinc-700 bg-zinc-900 text-zinc-400"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isNotificationLive ? "bg-emerald-300" : "bg-zinc-600"
                            }`}
                          />
                          {isNotificationLive ? "Live" : "Reconnecting"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/8 bg-white/5 p-4">
                      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
                        Notification ID
                      </p>
                      <p className="mt-2 break-all font-mono text-sm text-blue-200">
                        {notificationInfo.id}
                      </p>
                    </div>

                    <p className="mt-4 text-sm text-zinc-400">
                      Once the clinic team reviews this scan request, you can check here to see whether the alert has been opened.
                    </p>

                    <button
                      onClick={() => void refreshNotificationStatus()}
                      disabled={isRefreshingNotification}
                      className="mt-4 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-100 transition hover:border-blue-300 hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCw
                        size={14}
                        className={isRefreshingNotification ? "animate-spin" : ""}
                      />
                      {isRefreshingNotification ? "Refreshing status..." : "Check latest status"}
                    </button>
                  </div>
                )}
                {submissionState === "error" && (
                  <button
                    onClick={() => void submitScan()}
                    className="mt-5 inline-flex items-center gap-2 rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-white transition hover:border-zinc-500"
                  >
                    <RefreshCw size={16} />
                    Retry upload
                  </button>
                )}
              </div>

              {submissionState === "success" && scanId && (
                <QuickMessageSidebar patientId={DEMO_PATIENT_ID} scanId={scanId} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-10 w-full flex justify-center">
        {currentStep < 5 && (
          <button
            onClick={handleCapture}
            disabled={!camReady}
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-transform active:scale-90 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:opacity-50"
          >
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
               <Camera className="text-black" />
            </div>
          </button>
        )}
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 p-4 overflow-x-auto w-full">
        {VIEWS.map((v, i) => (
          <div 
            key={i} 
            className={`w-16 h-20 rounded border-2 shrink-0 ${i === currentStep ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-800'}`}
          >
            {capturedImages[i] ? (
               <img src={capturedImages[i]} alt={`${v.label} capture`} className="w-full h-full object-cover" />
            ) : (
               <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-700">{i+1}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
