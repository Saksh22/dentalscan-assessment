"use client";

import { memo } from "react";

import { GUIDE_TONE_STYLES } from "./utils/guide";
import { GuideFeedback } from "./utils/types";

type GuidanceOverlayProps = {
  feedback: GuideFeedback;
  viewLabel: string;
};

export const GuidanceOverlay = memo(function GuidanceOverlay({
  feedback,
  viewLabel,
}: GuidanceOverlayProps) {
  const toneStyles = GUIDE_TONE_STYLES[feedback.tone];

  return (
    <div className="pointer-events-none absolute inset-0">
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
            <div
              className={`absolute inset-[9%] rounded-[45%] border border-dashed transition-all duration-300 ${toneStyles.innerRing}`}
            />
            <div className="absolute left-1/2 top-1/2 h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-[48%] border border-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
});
