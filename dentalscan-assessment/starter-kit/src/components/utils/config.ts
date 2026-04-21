import { ScanView } from "./types";

export const DEMO_PATIENT_ID = "patient-demo";
export const DEMO_CLINIC_ID = "clinic-demo";

export const SCAN_VIEWS: ReadonlyArray<ScanView> = [
  { label: "Front View", instruction: "Smile and look straight at the camera." },
  { label: "Left View", instruction: "Turn your head to the left." },
  { label: "Right View", instruction: "Turn your head to the right." },
  { label: "Upper Teeth", instruction: "Tilt your head back and open wide." },
  { label: "Lower Teeth", instruction: "Tilt your head down and open wide." },
];
