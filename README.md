# DentalScan Assessment

This repository contains my submission for the DentalScan full-stack engineering challenge.

## Contents

- `AUDIT.md`: short UX and technical audit of the live DentalScan flow.
- `dentalscan-assessment/starter-kit`: Next.js application used for the implementation.

## Implemented Areas

The app in `dentalscan-assessment/starter-kit` covers the three core challenge areas:

1. Visual scan guidance in the camera flow to help users frame each capture step.
2. Scan-complete notifications backed by Prisma persistence and non-blocking dispatch.
3. Patient-clinic messaging with message history, optimistic updates, retry handling, and live stream support.

## Local Setup

From `dentalscan-assessment/starter-kit`:

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Useful Paths

- `dentalscan-assessment/starter-kit/src/components/ScanningFlow.tsx`
- `dentalscan-assessment/starter-kit/src/components/GuidanceOverlay.tsx`
- `dentalscan-assessment/starter-kit/src/app/api/notify/route.ts`
- `dentalscan-assessment/starter-kit/src/app/api/messaging/route.ts`
- `dentalscan-assessment/starter-kit/prisma/schema.prisma`

## Implementation Screenshots/Videos

## Notes

- The starter app already includes its own README inside `dentalscan-assessment/starter-kit/README.md`.
- The Prisma datasource is configured to use a local SQLite database at `prisma/dev.db`.
