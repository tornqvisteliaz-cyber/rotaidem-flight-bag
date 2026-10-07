export const PROTOCOL_VERSION = 1;

export type MessageType =
  | "connection.status"
  | "aircraft.state"
  | "flight.state"
  | "flight.plan.updated"
  | "weather.updated"
  | "airport.updated"
  | "vatsim.updated";

export interface Envelope<T = unknown> {
  protocolVersion: number;
  type: MessageType;
  timestamp: number;
  data: T;
}

export interface FlightState {
  phase: string;
  aircraft: { title: string; registration: string; airline: string };
  flight: { callsign: string; flightNumber: string; departure: string; arrival: string; alternate: string };
  position: { latitude: number; longitude: number; altitude: number; heading: number; onGround: boolean; radioHeight: number };
  speed: { ias: number; tas: number; groundSpeed: number; mach: number; verticalSpeed: number };
  fuel: { total: number };
  nav: { active: string; next: string; distanceNm: number };
  wind: { direction: number; speed: number };
  progress: number;
  distanceRemainingNm: number;
  eta: string;
  flightTime: string;
  track: number;
  updatedAt: number;
}

export interface Plan {
  flightNumber: string;
  callsign: string;
  departure: string;
  arrival: string;
  alternate: string;
  route: string;
  sid: string;
  star: string;
  cruiseAltitude: number;
  costIndex: string;
  weights: { zfw: number; tow: number; lw: number };
  fuel: { block: number; trip: number; taxi: number; reserve: number; alternate: number };
  passengers: number;
  cargo: number;
  source: string;
}

export interface WeatherReport {
  icao: string;
  observed: string;
  raw: string;
  taf: string;
  wind: string;
  visibility: string;
  temperature: string;
  dewpoint: string;
  qnh: string;
  clouds: string;
  updatedAt: number;
}

export interface VatStation {
  role: string;
  callsign: string;
  frequency: string;
  online: boolean;
}

export const emptyFlight = (): FlightState => ({
  phase: "PARKED",
  aircraft: { title: "—", registration: "—", airline: "—" },
  flight: { callsign: "—", flightNumber: "—", departure: "——", arrival: "——", alternate: "——" },
  position: { latitude: 0, longitude: 0, altitude: 0, heading: 0, onGround: true, radioHeight: 0 },
  speed: { ias: 0, tas: 0, groundSpeed: 0, mach: 0, verticalSpeed: 0 },
  fuel: { total: 0 },
  nav: { active: "—", next: "—", distanceNm: 0 },
  wind: { direction: 0, speed: 0 },
  progress: 0,
  distanceRemainingNm: 0,
  eta: "—",
  flightTime: "—",
  track: 0,
  updatedAt: 0,
});
