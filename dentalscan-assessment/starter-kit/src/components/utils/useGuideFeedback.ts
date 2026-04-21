import { RefObject, useEffect, useRef, useState } from "react";

import { getFaceDetector } from "./faceDetector";
import { DEFAULT_GUIDE_FEEDBACK, areGuideFeedbacksEqual, deriveGuideFeedback, sampleVideoMotion } from "./guide";
import { FaceFrameMetrics, FrameAnalysisCanvas, GuideFeedback } from "./types";

type UseGuideFeedbackParams = {
  videoRef: RefObject<HTMLVideoElement>;
  camReady: boolean;
  resetKey: string;
};

export function useGuideFeedback({
  videoRef,
  camReady,
  resetKey,
}: UseGuideFeedbackParams) {
  const frameAnalysisCanvasRef = useRef<FrameAnalysisCanvas | null>(null);
  const smoothedMotionScoreRef = useRef<number | null>(null);
  const lastGuideFeedbackRef = useRef<GuideFeedback | null>(DEFAULT_GUIDE_FEEDBACK);
  const faceDetectorPromiseRef = useRef<ReturnType<typeof getFaceDetector> | null>(null);
  const [guideFeedback, setGuideFeedback] = useState<GuideFeedback>(DEFAULT_GUIDE_FEEDBACK);

  useEffect(() => {
    setGuideFeedback(DEFAULT_GUIDE_FEEDBACK);
    lastGuideFeedbackRef.current = DEFAULT_GUIDE_FEEDBACK;
    smoothedMotionScoreRef.current = null;
    frameAnalysisCanvasRef.current = null;

    if (!camReady) {
      return;
    }

    let isCancelled = false;
    let isAnalyzing = false;
    let timeoutId: number | undefined;

    const summarizeFaceFrame = async (video: HTMLVideoElement): Promise<FaceFrameMetrics | null> => {
      const detectorPromise = faceDetectorPromiseRef.current ?? getFaceDetector();
      faceDetectorPromiseRef.current = detectorPromise;

      try {
        const detector = await detectorPromise;
        const detections = detector.detectForVideo(video, performance.now()).detections;
        const primaryFace = detections[0];
        const boundingBox = primaryFace?.boundingBox;

        if (!boundingBox || video.videoHeight === 0 || video.videoWidth === 0) {
          return {
            detectedFaceCount: detections.length,
            primaryFaceHeightRatio: null,
            primaryFaceWidthRatio: null,
            centerOffsetRatio: null,
          };
        }

        const faceCenterX = boundingBox.originX + boundingBox.width / 2;
        const faceCenterY = boundingBox.originY + boundingBox.height / 2;
        const frameCenterX = video.videoWidth / 2;
        const frameCenterY = video.videoHeight / 2;
        const horizontalOffset = Math.abs(faceCenterX - frameCenterX) / video.videoWidth;
        const verticalOffset = Math.abs(faceCenterY - frameCenterY) / video.videoHeight;

        return {
          detectedFaceCount: detections.length,
          primaryFaceHeightRatio: boundingBox.height / video.videoHeight,
          primaryFaceWidthRatio: boundingBox.width / video.videoWidth,
          centerOffsetRatio: Math.max(horizontalOffset, verticalOffset),
        };
      } catch (error) {
        console.error("Unable to analyze face distance", error);

        return null;
      }
    };

    const scheduleNextAnalysis = () => {
      if (!isCancelled) {
        timeoutId = window.setTimeout(analyzeFrame, 420);
      }
    };

    const analyzeFrame = async () => {
      if (isCancelled || isAnalyzing) {
        return;
      }

      const video = videoRef.current;

      if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        timeoutId = window.setTimeout(analyzeFrame, 300);
        return;
      }

      isAnalyzing = true;

      try {
        const videoMotionScore = sampleVideoMotion(video, frameAnalysisCanvasRef);

        if (videoMotionScore != null) {
          smoothedMotionScoreRef.current =
            smoothedMotionScoreRef.current == null
              ? videoMotionScore
              : smoothedMotionScoreRef.current * 0.58 + videoMotionScore * 0.42;
        }

        const faceMetrics = await summarizeFaceFrame(video);

        if (isCancelled) {
          return;
        }

        const nextGuideFeedback = deriveGuideFeedback({
          frameWidth: video.videoWidth,
          frameHeight: video.videoHeight,
          motionScore: smoothedMotionScoreRef.current,
          faceMetrics,
        });

        if (!areGuideFeedbacksEqual(lastGuideFeedbackRef.current, nextGuideFeedback)) {
          lastGuideFeedbackRef.current = nextGuideFeedback;
          setGuideFeedback(nextGuideFeedback);
        }
      } finally {
        isAnalyzing = false;
        scheduleNextAnalysis();
      }
    };

    void analyzeFrame();

    return () => {
      isCancelled = true;
      smoothedMotionScoreRef.current = null;
      lastGuideFeedbackRef.current = DEFAULT_GUIDE_FEEDBACK;
      frameAnalysisCanvasRef.current = null;
      faceDetectorPromiseRef.current = null;

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [camReady, resetKey, videoRef]);

  return guideFeedback;
}
