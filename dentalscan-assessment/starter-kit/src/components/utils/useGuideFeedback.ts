import { RefObject, useEffect, useRef, useState } from "react";

import { DEFAULT_GUIDE_FEEDBACK, areGuideFeedbacksEqual, deriveGuideFeedback, sampleVideoMotion } from "./guide";
import { FrameAnalysisCanvas, GuideFeedback } from "./types";

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
  }, [camReady, resetKey, videoRef]);

  return guideFeedback;
}
