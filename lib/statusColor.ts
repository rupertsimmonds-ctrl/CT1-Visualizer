import type { StatusCode, BedroomCode } from "./types";

export const STATUS_FILL: Record<StatusCode, string> = {
  not_launched: "#E8DBC8",
  marketing: "#B39470",
  viewing: "#D9B9A0",
  inflight: "#BF956E",
  reserved_bh: "#D9B9A0",
  reserved_hh: "#D9B9A0",
  signed_bh: "#1F343F",
  signed_hh: "#7BA0B2",
  occupied_bh: "#1F343F",
  occupied_hh: "#7BA0B2",
  show_flat: "#2C537A",
  lost: "#FF787A",
};

export const STATUS_RING: Partial<Record<StatusCode, string>> = {
  reserved_bh: "#1F343F",
  reserved_hh: "#7BA0B2",
  occupied_bh: "#D9B9A0",
  occupied_hh: "#1F343F",
  show_flat: "#FFFFFF",
};

export const TYPE_EDGE: Record<BedroomCode, string> = {
  studio: "rgba(122,160,178,0.85)",
  "1br": "#2C537A",
  "2br": "rgba(31,52,63,0.65)",
  "3br": "rgba(160,103,103,0.85)",
  "4br": "#A06767",
};
