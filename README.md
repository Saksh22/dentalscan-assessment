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
### Task 1: Scan Enhancement
FE:
<img width="1904" height="911" alt="image" src="https://github.com/user-attachments/assets/fcae2ea1-7492-472d-bc6f-13b7fba4e6ef" />

### Task 2: Notification System
BE :
<img width="1901" height="344" alt="image" src="https://github.com/user-attachments/assets/16c8369e-571d-42fd-8ec5-890601d5ae48" />

### Task 3: Patient-Dentist Messaging 
FE:
<img width="1899" height="794" alt="image" src="https://github.com/user-attachments/assets/936d50cf-9457-4e12-aace-f175eb999f75" />
BE:
<img width="1902" height="389" alt="image" src="https://github.com/user-attachments/assets/6d3580d8-e718-4839-ba66-5ec992e0fbe4" />
<img width="1910" height="501" alt="image" src="https://github.com/user-attachments/assets/fdc83b5d-75ba-483c-9e92-22b9601c1b6e" />







## Notes

- The starter app already includes its own README inside `dentalscan-assessment/starter-kit/README.md`.
- The Prisma datasource is configured to use a local SQLite database at `prisma/dev.db`.
