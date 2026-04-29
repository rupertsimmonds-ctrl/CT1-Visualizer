export type BedroomCode = "studio" | "1br" | "2br" | "3br" | "4br";

export type StatusCode =
  | "not_launched"
  | "marketing"
  | "viewing"
  | "inflight"
  | "reserved_bh"
  | "reserved_hh"
  | "signed_bh"
  | "signed_hh"
  | "occupied_bh"
  | "occupied_hh"
  | "show_flat"
  | "lost";

export interface Unit {
  uid: string;
  f: number;
  p: number;
  t: BedroomCode;
  d: boolean;
  v: string;
  fb?: string | null;
  sq: number;
  pr: number;
  orig: number;
  psf: number | null;
  tr: string;
  b: boolean;
  bsq: number;
  s: StatusCode;
  st?: string | null;
  ag?: string | null;
  br?: string | null;
  dom?: number | null;
  sgnD?: string | null;
  sgnR?: number | null;
  aVa?: number | null;
  lt?: string | null;
  lr?: string | null;
}

export interface UnitsPayload {
  units: Unit[];
  source: "live" | "snapshot";
  fetchedAt: string;
  error?: string;
}
