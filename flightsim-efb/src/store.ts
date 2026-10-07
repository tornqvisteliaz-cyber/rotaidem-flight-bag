import { useEffect, useState } from "react";
import { emptyFlight, type Envelope, type FlightState, type Plan, type VatStation, type WeatherReport } from "./protocol";

type Listener = () => void;

const flight = emptyFlight();
let link: "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "BRIDGE OFFLINE" = "DISCONNECTED";
let msfs: "CONNECTED" | "MSFS NOT DETECTED" = "MSFS NOT DETECTED";
let plan: Plan | null = null;
let weather: Record<string, WeatherReport> = {};
let vatsim: Record<string, VatStation[]> = {};
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function snapshot() {
  return { flight, link, msfs, plan, weather, vatsim };
}

export function useStore() {
  const [, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick((n) => n + 1)), []);
  return snapshot();
}

export function apply(message: Envelope) {
  if (message.type === "flight.state" || message.type === "aircraft.state") {
    Object.assign(flight, message.data);
    flight.updatedAt = message.timestamp;
  }
  if (message.type === "connection.status") {
    const data = message.data as { bridge?: string; msfs?: string };
    if (data.bridge) link = data.bridge as typeof link;
    if (data.msfs) msfs = data.msfs as typeof msfs;
  }
  if (message.type === "flight.plan.updated") plan = message.data as Plan;
  if (message.type === "weather.updated") {
    const report = message.data as WeatherReport;
    weather = { ...weather, [report.icao]: report };
  }
  if (message.type === "vatsim.updated") {
    const data = message.data as { icao: string; stations: VatStation[] };
    vatsim = { ...vatsim, [data.icao]: data.stations };
  }
  emit();
}

export function setLink(next: typeof link) {
  link = next;
  emit();
}

export function altitudeText(feet: number) {
  if (!feet) return "—";
  return feet >= 18000 ? "FL" + String(Math.round(feet / 100)).padStart(3, "0") : Math.round(feet) + " ft";
}

export function fuelText(kg: number) {
  return kg ? (kg / 1000).toFixed(1) + " t" : "—";
}
