import type { Unit, BedroomCode, StatusCode } from "./types";
import { AVAILABLE_STATES, BH_LET_STATES, HH_LET_STATES, BEDROOM_ORDER, TYPE_META, TOTAL_UNITS } from "./constants";

export interface OverviewKpis {
  total: number;
  available: number;
  bhLet: number;
  hhLet: number;
  lost: number;
  showFlat: number;
  byBedroomAvailable: { type: BedroomCode; label: string; color: string; count: number }[];
  showFlats: Unit[];
  mix: {
    type: BedroomCode;
    label: string;
    color: string;
    count: number;
    avgRent: number;
    minRent: number;
    maxRent: number;
  }[];
}

const isAvailable = (s: StatusCode) => AVAILABLE_STATES.includes(s);
const isBhLet = (s: StatusCode) => BH_LET_STATES.includes(s);
const isHhLet = (s: StatusCode) => HH_LET_STATES.includes(s);

export function buildOverview(units: Unit[]): OverviewKpis {
  const total = units.length || TOTAL_UNITS;
  let available = 0, bhLet = 0, hhLet = 0, lost = 0, showFlat = 0;

  for (const u of units) {
    if (isAvailable(u.s)) available++;
    else if (isBhLet(u.s)) bhLet++;
    else if (isHhLet(u.s)) hhLet++;
    else if (u.s === "lost") lost++;
    else if (u.s === "show_flat") showFlat++;
  }

  const byBedroomAvailable = BEDROOM_ORDER.map((type) => {
    const count = units.filter((u) => u.t === type && isAvailable(u.s)).length;
    return { type, label: TYPE_META[type].label, color: TYPE_META[type].color, count };
  });

  const showFlats = units.filter((u) => u.s === "show_flat").sort((a, b) => a.f - b.f || a.p - b.p);

  const mix = BEDROOM_ORDER.map((type) => {
    const subset = units.filter((u) => u.t === type);
    const rents = subset.map((u) => u.pr).filter((r) => r > 0);
    const sum = rents.reduce((a, b) => a + b, 0);
    return {
      type,
      label: TYPE_META[type].label,
      color: TYPE_META[type].color,
      count: subset.length,
      avgRent: rents.length ? sum / rents.length : 0,
      minRent: rents.length ? Math.min(...rents) : 0,
      maxRent: rents.length ? Math.max(...rents) : 0,
    };
  });

  return { total, available, bhLet, hhLet, lost, showFlat, byBedroomAvailable, showFlats, mix };
}

export function filterAvailable(
  units: Unit[],
  filter: { bed: BedroomCode | "all"; balcony: boolean; duplex: boolean; show: boolean }
): Unit[] {
  return units
    .filter((u) => (filter.show ? u.s === "show_flat" || isAvailable(u.s) : isAvailable(u.s)))
    .filter((u) => filter.bed === "all" || u.t === filter.bed)
    .filter((u) => (filter.balcony ? u.b : true))
    .filter((u) => (filter.duplex ? u.d : true))
    .sort((a, b) => a.f - b.f || a.p - b.p);
}
