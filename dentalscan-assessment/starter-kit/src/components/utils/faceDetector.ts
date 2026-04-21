const MEDIAPIPE_WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";
const FACE_DETECTOR_MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

type FaceDetectorInstance = {
  detectForVideo(
    video: HTMLVideoElement,
    timestampMs: number
  ): {
    detections: Array<{
      boundingBox?: {
        originX: number;
        originY: number;
        width: number;
        height: number;
      };
    }>;
  };
};

let detectorPromise: Promise<FaceDetectorInstance> | null = null;

export function getFaceDetector() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Face detector is only available in the browser."));
  }

  if (!detectorPromise) {
    detectorPromise = import("@mediapipe/tasks-vision")
      .then(({ FaceDetector, FilesetResolver }) =>
        FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH).then((vision) =>
          FaceDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: FACE_DETECTOR_MODEL_PATH,
            },
            runningMode: "VIDEO",
            minDetectionConfidence: 0.45,
          })
        )
      )
      .then((vision) =>
        vision as FaceDetectorInstance
      )
      .catch((error: unknown) => {
        detectorPromise = null;
        throw error;
      });
  }

  return detectorPromise;
}
