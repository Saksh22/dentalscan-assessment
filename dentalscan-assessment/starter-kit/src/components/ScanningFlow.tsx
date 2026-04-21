"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Camera } from "lucide-react";
import { GuidanceOverlay } from "@/components/GuidanceOverlay";
import { ScanCompletionPanel } from "@/components/ScanCompletionPanel";
import { GUIDE_TONE_STYLES } from "@/components/utils/guide";
import { useGuideFeedback } from "@/components/utils/useGuideFeedback";
import { useScanSubmission } from "@/components/utils/useScanSubmission";

export default function ScanningFlow() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camReady, setCamReady] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const VIEWS = [
    { label: "Front View", instruction: "Smile and look straight at the camera." },
    { label: "Left View", instruction: "Turn your head to the left." },
    { label: "Right View", instruction: "Turn your head to the right." },
    { label: "Upper Teeth", instruction: "Tilt your head back and open wide." },
    { label: "Lower Teeth", instruction: "Tilt your head down and open wide." },
  ];

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCamReady(true);
        }
      } catch (err) {
        console.error("Camera access denied", err);
      }
    }

    void startCamera();

    return () => {
      setCamReady(false);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

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
  }, []);

  const guideFeedback = useGuideFeedback({
    videoRef,
    camReady,
    resetKey: VIEWS[currentStep]?.label ?? "complete",
  });

  const {
    submissionState,
    submissionMessage,
    scanId,
    notificationInfo,
    isRefreshingNotification,
    isNotificationLive,
    submitScan,
    refreshNotificationStatus,
  } = useScanSubmission(capturedImages, VIEWS.length);

  return (
    <div className="flex min-h-screen flex-col items-center bg-black text-white">
      <div className="flex w-full justify-between border-b border-zinc-800 bg-zinc-900 p-4">
        <h1 className="font-bold text-blue-400">DentalScan AI</h1>
        <span className="text-xs text-zinc-500">
          Step {Math.min(currentStep + 1, VIEWS.length)}/{VIEWS.length}
        </span>
      </div>

      <div
        className={`relative w-full overflow-hidden bg-zinc-950 ${
          currentStep < VIEWS.length
            ? "flex max-w-md aspect-[3/4] items-center justify-center"
            : "max-w-6xl min-h-[42rem]"
        }`}
      >
        {currentStep < VIEWS.length ? (
          <>
            <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />

            <GuidanceOverlay feedback={guideFeedback} viewLabel={VIEWS[currentStep].label} />

            <div className="absolute bottom-10 left-0 right-0 bg-gradient-to-t from-black to-transparent p-6 text-center">
              <p className="text-sm font-medium">
                {VIEWS[currentStep].instruction}{" "}
                <span
                  className={`font-semibold ${
                    GUIDE_TONE_STYLES[guideFeedback.tone].chip.split(" ").at(-1)
                  }`}
                >
                  {guideFeedback.badge.toLowerCase()}.
                </span>
              </p>
            </div>
          </>
        ) : (
          <ScanCompletionPanel
            submissionState={submissionState}
            submissionMessage={submissionMessage}
            scanId={scanId}
            notificationInfo={notificationInfo}
            isNotificationLive={isNotificationLive}
            isRefreshingNotification={isRefreshingNotification}
            onRefreshNotification={() => void refreshNotificationStatus()}
            onRetryUpload={() => void submitScan()}
          />
        )}
      </div>

      <div className="flex w-full justify-center p-10">
        {currentStep < VIEWS.length && (
          <button
            onClick={handleCapture}
            disabled={!camReady}
            className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white transition-transform active:scale-90 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:opacity-50"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white">
              <Camera className="text-black" />
            </div>
          </button>
        )}
      </div>

      <div className="flex w-full gap-2 overflow-x-auto p-4">
        {VIEWS.map((view, index) => (
          <div
            key={view.label}
            className={`h-20 w-16 shrink-0 rounded border-2 ${
              index === currentStep ? "border-blue-500 bg-blue-500/10" : "border-zinc-800"
            }`}
          >
            {capturedImages[index] ? (
              <img
                src={capturedImages[index]}
                alt={`${view.label} capture`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-700">
                {index + 1}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
