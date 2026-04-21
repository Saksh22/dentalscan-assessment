"use client";

import { CheckCircle2, RefreshCw } from "lucide-react";

import QuickMessageSidebar from "@/components/QuickMessageSidebar";

import { DEMO_PATIENT_ID } from "./utils/config";
import { NotificationInfo, SubmissionState } from "./utils/types";

type ScanCompletionPanelProps = {
  submissionState: SubmissionState;
  submissionMessage: string;
  scanId: string | null;
  notificationInfo: NotificationInfo | null;
  isNotificationLive: boolean;
  isRefreshingNotification: boolean;
  onRefreshNotification: () => void;
  onRetryUpload: () => void;
};

function NotificationCard({
  notificationInfo,
  isNotificationLive,
  isRefreshingNotification,
  onRefreshNotification,
}: {
  notificationInfo: NotificationInfo;
  isNotificationLive: boolean;
  isRefreshingNotification: boolean;
  onRefreshNotification: () => void;
}) {
  return (
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
        <p className="mt-2 break-all font-mono text-sm text-blue-200">{notificationInfo.id}</p>
      </div>

      <p className="mt-4 text-sm text-zinc-400">
        Once the clinic team reviews this scan request, you can check here to see whether the
        alert has been opened.
      </p>

      <button
        onClick={onRefreshNotification}
        disabled={isRefreshingNotification}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-100 transition hover:border-blue-300 hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw size={14} className={isRefreshingNotification ? "animate-spin" : ""} />
        {isRefreshingNotification ? "Refreshing status..." : "Check latest status"}
      </button>
    </div>
  );
}

export function ScanCompletionPanel({
  submissionState,
  submissionMessage,
  scanId,
  notificationInfo,
  isNotificationLive,
  isRefreshingNotification,
  onRefreshNotification,
  onRetryUpload,
}: ScanCompletionPanelProps) {
  return (
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
            <NotificationCard
              notificationInfo={notificationInfo}
              isNotificationLive={isNotificationLive}
              isRefreshingNotification={isRefreshingNotification}
              onRefreshNotification={onRefreshNotification}
            />
          )}

          {submissionState === "error" && (
            <button
              onClick={onRetryUpload}
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
  );
}
