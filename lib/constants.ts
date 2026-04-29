import type { BedroomCode, StatusCode } from "./types";

export const SHEET_ID = "1FOofWcGkSXXnBWZ70dB7tix9T5lHjV3BL8evePp-URk";
export const SHEET_TAB = "07_HTML_Export";
export const REVALIDATE_SECONDS = 30;

export const BEDROOM_CODE: Record<string, BedroomCode> = {
  Studio: "studio",
  "1 Bedroom": "1br",
  "2 Bedroom": "2br",
  "3 Bedroom": "3br",
  "4 Bedroom": "4br",
};

export const TYPE_META: Record<BedroomCode, { label: string; color: string }> = {
  studio: { label: "Studio", color: "#7BA0B2" },
  "1br": { label: "1 Bedroom", color: "#2C537A" },
  "2br": { label: "2 Bedroom", color: "#1F343F" },
  "3br": { label: "3 Bedroom", color: "#A06767" },
  "4br": { label: "4 Bedroom", color: "#A06767" },
};

export const BEDROOM_ORDER: BedroomCode[] = ["studio", "1br", "2br", "3br", "4br"];

export const STATUS_LABEL: Record<StatusCode, string> = {
  not_launched: "Not Launched",
  marketing: "Marketing",
  viewing: "Viewing",
  inflight: "In Flight",
  reserved_bh: "Reserved · BH",
  reserved_hh: "Reserved · H&H",
  signed_bh: "Signed · BH",
  signed_hh: "Signed · H&H",
  occupied_bh: "Occupied · BH",
  occupied_hh: "Occupied · H&H",
  show_flat: "Show Flat",
  lost: "Lost",
};

export const AVAILABLE_STATES: StatusCode[] = ["not_launched", "marketing", "viewing", "inflight"];
export const BH_LET_STATES: StatusCode[] = ["reserved_bh", "signed_bh", "occupied_bh"];
export const HH_LET_STATES: StatusCode[] = ["reserved_hh", "signed_hh", "occupied_hh"];

export const TOTAL_UNITS = 695;
