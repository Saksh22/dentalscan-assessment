import { useCallback, useEffect, useState } from "react";

import { DEMO_CLINIC_ID } from "./config";
import { NotificationInfo, SubmissionState } from "./types";

const INITIAL_SUBMISSION_MESSAGE = "Uploading results...";

export function useScanSubmission(capturedImages: string[], totalViews: number) {
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const [submissionMessage, setSubmissionMessage] = useState(INITIAL_SUBMISSION_MESSAGE);
  const [scanId, setScanId] = useState<string | null>(null);
  const [notificationInfo, setNotificationInfo] = useState<NotificationInfo | null>(null);
  const [isRefreshingNotification, setIsRefreshingNotification] = useState(false);
  const [isNotificationLive, setIsNotificationLive] = useState(false);

  const submitScan = useCallback(async () => {
    setSubmissionState("uploading");
    setSubmissionMessage(INITIAL_SUBMISSION_MESSAGE);
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
          userId: DEMO_CLINIC_ID,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Upload failed");
      }

      setSubmissionState("success");
      setScanId(data.scanId);
      setSubmissionMessage(
        "The Clinic has been notified and someone will join the telehealth room soon."
      );
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

  const refreshNotificationStatus = useCallback(
    async (options?: { silent?: boolean }) => {
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
    },
    [notificationInfo?.id]
  );

  useEffect(() => {
    if (capturedImages.length === totalViews && submissionState === "idle") {
      void submitScan();
    }
  }, [capturedImages.length, submissionState, submitScan, totalViews]);

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
        const payload = JSON.parse(event.data) as NotificationInfo;

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

  return {
    submissionState,
    submissionMessage,
    scanId,
    notificationInfo,
    isRefreshingNotification,
    isNotificationLive,
    submitScan,
    refreshNotificationStatus,
  };
}
