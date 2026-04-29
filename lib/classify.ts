import type { StatusCode } from "./types";

export function classify(rawStatus: string | null | undefined, agencyWon: string | null | undefined): StatusCode {
  const s = (rawStatus || "Not Launched").trim();
  const a = (agencyWon || "").trim();

  if (s === "Not Launched") return "not_launched";
  if (s === "Marketing") return "marketing";
  if (s === "Viewing Booked" || s === "Viewing Held") return "viewing";
  if (s === "Offer Received" || s === "Negotiating" || s === "Pipeline") return "inflight";
  if (s === "Reserved") return a === "BH" ? "reserved_bh" : a === "H&H" ? "reserved_hh" : "inflight";
  if (s === "Invoiced") return a === "BH" ? "signed_bh" : a === "H&H" ? "signed_hh" : "inflight";
  if (s === "Occupied") return a === "BH" ? "occupied_bh" : a === "H&H" ? "occupied_hh" : "signed_bh";
  if (s === "Show Flat") return "show_flat";
  if (s === "Lost") return "lost";
  return "marketing";
}
