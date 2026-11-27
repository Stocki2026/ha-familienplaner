/*
 * Rennstrecke-Card – Familien-Punkte-Rennen für Home Assistant
 * ------------------------------------------------------------
 * Zeigt alle Familienmitglieder als Fahrzeuge auf einer kleinen Rennstrecke.
 * Die Position richtet sich nach den Punkten (Ziel = Ziellinie).
 * Jede Person wählt Fahrzeug und Farbe selbst (Garage-Knopf in der Karte).
 *
 * Keine weiteren Abhängigkeiten. Wird von der Integration „Familienplaner“ automatisch geladen.
 * Ohne Integration: Datei nach /config/www/ kopieren und als Ressource (JavaScript-Modul) eintragen.
 *
 * Icons: Material Design Icons (Apache License 2.0), https://pictogrammers.com
 */

const RC_VERSION = "1.1.0";

const RC_ICONS = {
  auto: "M16,6L19,10H21C22.11,10 23,10.89 23,12V15H21A3,3 0 0,1 18,18A3,3 0 0,1 15,15H9A3,3 0 0,1 6,18A3,3 0 0,1 3,15H1V12C1,10.89 1.89,10 3,10L6,6H16M10.5,7.5H6.75L4.86,10H10.5V7.5M12,7.5V10H17.14L15.25,7.5H12M6,13.5A1.5,1.5 0 0,0 4.5,15A1.5,1.5 0 0,0 6,16.5A1.5,1.5 0 0,0 7.5,15A1.5,1.5 0 0,0 6,13.5M18,13.5A1.5,1.5 0 0,0 16.5,15A1.5,1.5 0 0,0 18,16.5A1.5,1.5 0 0,0 19.5,15A1.5,1.5 0 0,0 18,13.5Z",
  rennwagen: "M12,8.5H7L4,11H3C1.89,11 1,11.89 1,13V16H3.17C3.6,17.2 4.73,18 6,18C7.27,18 8.4,17.2 8.82,16H15.17C15.6,17.2 16.73,18 18,18C19.27,18 20.4,17.2 20.82,16H23V15C23,13.89 21.97,13.53 21,13L12,8.5M5.25,12L7.5,10H11.5L15.5,12H5.25M6,13.5A1.5,1.5 0 0,1 7.5,15A1.5,1.5 0 0,1 6,16.5A1.5,1.5 0 0,1 4.5,15A1.5,1.5 0 0,1 6,13.5M18,13.5A1.5,1.5 0 0,1 19.5,15A1.5,1.5 0 0,1 18,16.5A1.5,1.5 0 0,1 16.5,15A1.5,1.5 0 0,1 18,13.5Z",
  motorrad: "M17.42,10L13.41,6H9V8H12.59L14.59,10H6.5C4,10 2,12 2,14.5C2,17 4,19 6.5,19C8.72,19 10.56,17.38 10.92,15.27L13.04,14C13,14.17 13,14.33 13,14.5C13,17 15,19 17.5,19C20,19 22,17 22,14.5C22,12 20,10 17.5,10M8.84,15.26C8.5,16.27 7.58,17 6.47,17C5.09,17 3.97,15.88 3.97,14.5C3.97,13.12 5.09,12 6.47,12C7.59,12 8.5,12.74 8.84,13.75H6V15.25L8.84,15.26M17.47,17C16.09,17 14.97,15.88 14.97,14.5C14.97,13.12 16.09,12 17.47,12A2.5,2.5 0 0,1 19.97,14.5A2.5,2.5 0 0,1 17.47,17Z",
  pferd: "M22 6V9.5L20.5 10L18.96 7.54C18.83 7.33 18.5 7.42 18.5 7.67V11.25C18.5 12.23 18.11 13.11 17.5 13.78V21H15V15C14.92 15 14.84 15 14.75 15C14.54 15 14.33 14.97 14.13 14.94L9.69 14.2L8.57 16.21L9.53 21H7L6 16.25C5.97 15.95 6 15.65 6.16 15.39L7.18 13.58C6.2 13.03 5.53 12 5.5 10.81C5.46 10.96 5.44 11.18 5.47 11.5C5.5 11.94 5.61 12.59 5.54 13.31C5.5 14.03 5.17 14.77 4.75 15.26C4.32 15.75 3.85 16.09 3.35 16.35L2.65 15.65C2.84 15.18 3.03 14.76 3.07 14.37C3.13 14 3.06 13.7 2.95 13.43L2.42 12.3C2.21 11.79 1.95 11.05 2 10.18C2.03 9.33 2.5 8.22 3.39 7.61C4.29 7 5.26 6.92 6.05 7.08C6.55 7.18 7.06 7.42 7.5 7.76C7.87 7.59 8.3 7.5 8.75 7.5H14.5V7C14.5 4.79 16.29 3 18.5 3H22L21.11 4.34C21.65 4.7 22 5.31 22 6Z",
  einhorn: "M22 5L21.11 6.34C21.65 6.7 22 7.31 22 8V11.5L20.5 12L18.96 9.54C18.83 9.33 18.5 9.42 18.5 9.67V13.25C18.5 14.23 18.11 15.11 17.5 15.78V22H15V17C14.92 17 14.84 17 14.75 17C14.54 17 14.33 16.97 14.13 16.94L9.45 16.16L8.57 18.12L9.54 22H6.96L6.04 18.3C5.97 18.03 6 17.74 6.11 17.5L7 15.5C6.12 14.92 5.53 13.94 5.5 12.81C5.46 12.96 5.44 13.18 5.47 13.5C5.5 13.94 5.61 14.59 5.54 15.31C5.5 16.03 5.18 16.77 4.76 17.26C4.32 17.75 3.85 18.09 3.35 18.35L2.65 17.65C2.84 17.18 3.03 16.76 3.07 16.37C3.13 16 3.06 15.7 2.95 15.43L2.42 14.3C2.21 13.79 1.95 13.05 2 12.18C2.03 11.33 2.5 10.22 3.39 9.61C4.29 9 5.26 8.91 6.05 9.08C6.55 9.18 7.06 9.42 7.5 9.76C7.87 9.59 8.3 9.5 8.75 9.5H14.5V9C14.5 6.79 16.29 5 18.5 5L22 2L21 5H22Z",
  fahrrad: "M19 10C18.44 10 17.91 10.11 17.41 10.28L14.46 4.5H11V6H13.54L14.42 7.72L12 13.13L10.23 8.95C10.5 8.85 10.74 8.58 10.74 8.25C10.74 7.84 10.41 7.5 10 7.5H8C7.58 7.5 7.24 7.84 7.24 8.25S7.58 9 8 9H8.61L10.86 14.25H9.92C9.56 11.85 7.5 10 5 10C2.24 10 0 12.24 0 15S2.24 20 5 20C7.5 20 9.56 18.15 9.92 15.75H12.5L15.29 9.43L16.08 10.96C14.82 11.87 14 13.34 14 15C14 17.76 16.24 20 19 20S24 17.76 24 15 21.76 10 19 10M5 18.5C3.07 18.5 1.5 16.93 1.5 15S3.07 11.5 5 11.5C6.67 11.5 8.07 12.68 8.41 14.25H4V15.75H8.41C8.07 17.32 6.67 18.5 5 18.5M19 18.5C17.07 18.5 15.5 16.93 15.5 15C15.5 13.92 16 12.97 16.77 12.33L18.57 15.85L19.89 15.13L18.1 11.63C18.39 11.56 18.69 11.5 19 11.5C20.93 11.5 22.5 13.07 22.5 15S20.93 18.5 19 18.5Z",
  traktor: "M5,4V11.26C3.2,11.9 2,13.6 2,15.5C2,18 4,20 6.5,20C8.79,20 10.71,18.28 10.97,16H15.17C15.06,16.32 15,16.66 15,17A3,3 0 0,0 18,20A3,3 0 0,0 21,17C21,16.66 20.94,16.32 20.82,16H22V13C22,11.89 21.11,11 20,11H15.04L13.65,4H5M7,6H12L13,11V14H10.74C10.16,12.38 8.71,11.23 7,11.03V6M6.5,13.25A2.25,2.25 0 0,1 8.75,15.5A2.25,2.25 0 0,1 6.5,17.75A2.25,2.25 0 0,1 4.25,15.5A2.25,2.25 0 0,1 6.5,13.25M18,15.5A1.5,1.5 0 0,1 19.5,17A1.5,1.5 0 0,1 18,18.5A1.5,1.5 0 0,1 16.5,17A1.5,1.5 0 0,1 18,15.5Z",
  rakete: "M13.13 22.19L11.5 18.36C13.07 17.78 14.54 17 15.9 16.09L13.13 22.19M5.64 12.5L1.81 10.87L7.91 8.1C7 9.46 6.22 10.93 5.64 12.5M21.61 2.39C21.61 2.39 16.66 .269 11 5.93C8.81 8.12 7.5 10.53 6.65 12.64C6.37 13.39 6.56 14.21 7.11 14.77L9.24 16.89C9.79 17.45 10.61 17.63 11.36 17.35C13.5 16.53 15.88 15.19 18.07 13C23.73 7.34 21.61 2.39 21.61 2.39M14.54 9.46C13.76 8.68 13.76 7.41 14.54 6.63S16.59 5.85 17.37 6.63C18.14 7.41 18.15 8.68 17.37 9.46C16.59 10.24 15.32 10.24 14.54 9.46M8.88 16.53L7.47 15.12L8.88 16.53M6.24 22L9.88 18.36C9.54 18.27 9.21 18.12 8.91 17.91L4.83 22H6.24M2 22H3.41L8.18 17.24L6.76 15.83L2 20.59V22M2 19.17L6.09 15.09C5.88 14.79 5.73 14.47 5.64 14.12L2 17.76V19.17Z",
  krone: "M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5M19 19C19 19.6 18.6 20 18 20H6C5.4 20 5 19.6 5 19V18H19V19Z",
  pokal: "M18 2C17.1 2 16 3 16 4H8C8 3 6.9 2 6 2H2V11C2 12 3 13 4 13H6.2C6.6 15 7.9 16.7 11 17V19.08C8 19.54 8 22 8 22H16C16 22 16 19.54 13 19.08V17C16.1 16.7 17.4 15 17.8 13H20C21 13 22 12 22 11V2H18M6 11H4V4H6V11M20 11H18V4H20V11Z",
  flagge: "M14.4,6H20V16H13L12.6,14H7V21H5V4H14L14.4,6M14,14H16V12H18V10H16V8H14V10L13,8V6H11V8H9V6H7V8H9V10H7V12H9V10H11V12H13V10L14,12V14M11,10V8H13V10H11M14,10H16V12H14V10Z",
  garage: "M19,20H17V11H7V20H5V9L12,5L19,9V20M8,12H16V14H8V12M8,15H16V17H8V15M16,18V20H8V18H16Z",
  feuer: "M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2M14.5 17.5C14.22 17.74 13.76 18 13.4 18.1C12.28 18.5 11.16 17.94 10.5 17.28C11.69 17 12.4 16.12 12.61 15.23C12.78 14.43 12.46 13.77 12.33 13C12.21 12.26 12.23 11.63 12.5 10.94C12.69 11.32 12.89 11.7 13.13 12C13.9 13 15.11 13.44 15.37 14.8C15.41 14.94 15.43 15.08 15.43 15.23C15.46 16.05 15.1 16.95 14.5 17.5H14.5Z",
  schliessen: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
  haken: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
};

/* Monster-Trucks: eigene, originale Motive. Alle fahren nach rechts, mit Riesenreifen und Gesicht vorne.
   farbe = Karosserie ("var(--c)" = Personenfarbe), hinten = Teile hinter der Karosserie, vorne = Teile darüber. */
function rcTruck({ farbe = "var(--c)", hinten = "", vorne = "", mund = "" }) {
  const rad = (x) =>
    `<g><circle cx="${x}" cy="18.6" r="4.4" fill="#2B2926"/><circle cx="${x}" cy="18.6" r="3.6" fill="none" stroke="#4A4744" stroke-width="1.1" stroke-dasharray="1.1 1"/><circle cx="${x}" cy="18.6" r="1.6" fill="#C9C4BC"/></g>`;
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="multi">
  <rect x="5.2" y="12.4" width="13.6" height="2.6" rx="1" fill="#4A4744"/>
  ${hinten}
  <path style="fill:${farbe}" d="M2.6 13.2V9.8C2.6 9 3.2 8.6 3.9 8.6H9.4L11 5.1C11.3 4.6 11.7 4.4 12.2 4.4H16C16.6 4.4 17 4.6 17.3 5.1L19.1 8.6L21.7 9.1C22.6 9.3 23 9.8 23 10.6V13.2Z"/>
  <path d="M12.1 5.4H15.8L17.5 8.6H10.6Z" fill="#DDF1FA"/>
  <circle cx="13.3" cy="7.05" r="1.05" fill="#fff"/><circle cx="15.6" cy="7.05" r="1.05" fill="#fff"/>
  <circle cx="13.65" cy="7.2" r=".5" fill="#2B2926"/><circle cx="15.95" cy="7.2" r=".5" fill="#2B2926"/>
  <path d="M12.5 5.85Q13.3 5.35 14.1 5.85M14.8 5.85Q15.6 5.35 16.4 5.85" stroke="#2B2926" stroke-width=".4" fill="none" stroke-linecap="round"/>
  ${mund || `<path d="M19.7 10.4Q21.2 12.7 22.7 10.4Z" fill="#fff" stroke="#2B2926" stroke-width=".35"/>`}
  ${vorne}
  ${rad(6.4)}${rad(18)}
</svg>`;
}

const RC_FLAMMEN =
  `<path d="M3.4 12.8Q4.4 11.2 5.4 12Q6 10.2 7.4 11.4Q8.2 9.7 9.6 11.2Q10.6 10 11.6 11.6Q12.4 10.7 13.2 12.1L13.4 12.8Z" fill="#FFC93C"/>` +
  `<path d="M4.6 12.8Q5.4 11.9 6.1 12.4Q6.8 11.3 7.8 12.1Q8.6 11.1 9.6 12.2Q10.4 11.5 11.2 12.4L11.4 12.8Z" fill="#F0743C"/>`;

const RC_TRUCKS = {
  // Flammen-Truck in der eigenen Farbe
  monster: rcTruck({ vorne: RC_FLAMMEN }),
  // Hai: Rückenflosse, heller Bauch, spitze Zähne
  hai: rcTruck({
    farbe: "#6F8FA6",
    hinten: `<path d="M12.6 4.8L14.4 0.9Q15.2 2.6 16.2 4.8Z" fill="#56748A"/>`,
    vorne: `<path d="M2.6 11.6H23V13.2H2.6Z" fill="#EEF3F6"/><path d="M5 9.8L6 10.6L5 11.4M7 9.8L8 10.6L7 11.4" stroke="#56748A" stroke-width=".4" fill="none"/>`,
    mund: `<path d="M19.6 10.2Q21.2 13 22.8 10.2Z" fill="#2B2926"/><path d="M19.9 10.2L20.3 11L20.7 10.2ZM21.1 10.2L21.5 11.2L21.9 10.2ZM22.2 10.2L22.5 10.9L22.7 10.2Z" fill="#fff"/>`,
  }),
  // Dino: Zacken auf Motorhaube und Dach, Flecken
  dino: rcTruck({
    farbe: "#5E9E4A",
    hinten: `<path d="M3.2 8.8L4 6.9L4.8 8.8ZM5.3 8.8L6.1 6.6L6.9 8.8ZM7.4 8.8L8.2 6.9L9 8.8ZM11.9 4.6L12.8 2.7L13.7 4.6ZM14.1 4.6L15 2.5L15.9 4.6Z" fill="#F0A23B"/>`,
    vorne: `<circle cx="5" cy="10.8" r=".8" fill="#4A8239"/><circle cx="8.2" cy="11.6" r=".6" fill="#4A8239"/><circle cx="11.4" cy="10.4" r=".7" fill="#4A8239"/>`,
  }),
  // Blitz: gelb mit schwarzem Blitz
  blitz: rcTruck({
    farbe: "#F2C230",
    vorne: `<path d="M4.2 12.7L7.4 9.4L7.6 10.9L11.4 8.9L8.6 12.7L8.3 11.3Z" fill="#2B2926"/>`,
  }),
  // Polizei: dunkelblau/weiß, Blaulicht und Stern
  polizei: rcTruck({
    farbe: "#2F4E86",
    hinten: `<rect x="12.2" y="3.1" width="1.8" height="1.4" rx=".4" fill="#E53935"/><rect x="14.1" y="3.1" width="1.8" height="1.4" rx=".4" fill="#1E88E5"/>`,
    vorne: `<path d="M2.6 11H23V13.2H2.6Z" fill="#F5F5F5"/><path d="M6.4 9.2L6.75 10L7.6 10.05L6.95 10.6L7.15 11.45L6.4 11L5.65 11.45L5.85 10.6L5.2 10.05L6.05 10Z" fill="#F2C230"/>`,
  }),
  // Feuerwehr: rot, Leiter auf dem Dach, Warnlicht
  feuerwehr: rcTruck({
    farbe: "#D2463C",
    hinten: `<rect x="14" y="3.2" width="1.6" height="1.3" rx=".4" fill="#FFB300"/>`,
    vorne: `<path d="M2.6 11.4H23V12.2H2.6Z" fill="#fff"/><g stroke="#C9C4BC" stroke-width=".45"><path d="M3.4 7.6H10.2M3.4 8.4H10.2"/><path d="M4.2 7.6V8.4M5.6 7.6V8.4M7 7.6V8.4M8.4 7.6V8.4M9.8 7.6V8.4"/></g>`,
  }),
  // Bagger: Baustellen-Gelb, Warnstreifen, Schaufel vorne
  bagger: rcTruck({
    farbe: "#F2A33A",
    hinten: `<rect x="14" y="3.2" width="1.6" height="1.3" rx=".4" fill="#FF7043"/>`,
    vorne: `<path d="M3 11.6H12V12.8H3Z" fill="#2B2926"/><path d="M3.4 12.8L4.4 11.6H5.4L4.4 12.8ZM5.8 12.8L6.8 11.6H7.8L6.8 12.8ZM8.2 12.8L9.2 11.6H10.2L9.2 12.8ZM10.6 12.8L11.6 11.6H12L11 12.8Z" fill="#F2C230"/><path d="M22.4 11.4L24 10.6V14.4L22.4 13.6Z" fill="#6B6560"/>`,
  }),
  // Einhorn: rosa, Horn auf der Haube, Regenbogen und Glitzer
  einhorn: rcTruck({
    farbe: "#E79CC2",
    hinten: `<circle cx="11.2" cy="5.3" r="1" fill="#9B7BC4"/><circle cx="10.4" cy="6.3" r=".9" fill="#7FC4E8"/><circle cx="9.9" cy="7.4" r=".8" fill="#9B7BC4"/>`,
    vorne: `<path d="M20 9L21 5.1L21.8 9.2Z" fill="#FFD75E"/><path d="M20.4 7.6L21.4 7.3M20.2 8.4L21.6 8.1" stroke="#E5A93C" stroke-width=".3"/>` +
      `<path d="M3 11.2Q8 9.8 13 11.2" stroke="#E53935" stroke-width=".5" fill="none"/><path d="M3 11.8Q8 10.4 13 11.8" stroke="#F2C230" stroke-width=".5" fill="none"/><path d="M3 12.4Q8 11 13 12.4" stroke="#1E88E5" stroke-width=".5" fill="none"/>` +
      `<path d="M5 9.6L5.25 10.15L5.8 10.4L5.25 10.65L5 11.2L4.75 10.65L4.2 10.4L4.75 10.15Z" fill="#fff"/><path d="M17.4 10.4L17.6 10.8L18 11L17.6 11.2L17.4 11.6L17.2 11.2L16.8 11L17.2 10.8Z" fill="#fff"/>`,
  }),
  // Rennsport: eigene Farbe, Heckspoiler, Startnummer
  renntruck: rcTruck({
    hinten: `<path d="M1.6 6.4H5.6V7.2H1.6Z" fill="#2B2926"/><rect x="3.3" y="7.2" width=".5" height="1.5" fill="#2B2926"/>`,
    vorne: `<circle cx="7" cy="10.8" r="1.4" fill="#fff"/><text x="7" y="11.45" font-size="1.9" font-weight="900" text-anchor="middle" fill="#2B2926" font-family="sans-serif">1</text>` +
      `<path d="M10 12.2H11V12.8H10ZM11 11.6H12V12.2H11ZM12 12.2H13V12.8H12Z" fill="#2B2926"/>`,
  }),
};

/* Fahrzeuge: Schlüsselwort im Auswahltext -> Icon + Ausrichtung (alle fahren nach rechts) */
const RC_FAHRZEUGE = [
  { key: "hai-truck", svg: RC_TRUCKS.hai, gallop: true },
  { key: "dino-truck", svg: RC_TRUCKS.dino, gallop: true },
  { key: "blitz-truck", svg: RC_TRUCKS.blitz, gallop: true },
  { key: "polizei-truck", svg: RC_TRUCKS.polizei, gallop: true },
  { key: "feuerwehr-truck", svg: RC_TRUCKS.feuerwehr, gallop: true },
  { key: "bagger-truck", svg: RC_TRUCKS.bagger, gallop: true },
  { key: "einhorn-truck", svg: RC_TRUCKS.einhorn, gallop: true },
  { key: "renn-truck", svg: RC_TRUCKS.renntruck, gallop: true },
  { key: "monster", svg: RC_TRUCKS.monster, gallop: true },
  { key: "renn", icon: "rennwagen", flip: true },
  { key: "sport", icon: "rennwagen", flip: true },
  { key: "motorrad", icon: "motorrad" },
  { key: "einhorn", icon: "einhorn", gallop: true },
  { key: "pferd", icon: "pferd", gallop: true },
  { key: "fahrrad", icon: "fahrrad" },
  { key: "traktor", icon: "traktor" },
  { key: "rakete", icon: "rakete", rotate: 45 },
  { key: "auto", icon: "auto" },
];

const RC_FARBEN = {
  blau: "#5B8DB8",
  pink: "#D9849B",
  orange: "#E39350",
  grün: "#6FA372",
  gruen: "#6FA372",
  rot: "#D45D5D",
  gelb: "#E5BE3C",
  lila: "#9B7BC4",
  türkis: "#3FAFAA",
  tuerkis: "#3FAFAA",
  braun: "#9A7256",
  grau: "#8A8F96",
  schwarz: "#3B3936",
  weiß: "#F4F1EA",
  weiss: "#F4F1EA",
  gold: "#C9A227",
  silber: "#B8BEC6",
};

const RC_LEVEL = [
  [0, "Bobbycar-Pilot", "Toy car pilot"],
  [100, "Seifenkisten-Fahrer", "Soapbox racer"],
  [250, "Kart-Talent", "Kart talent"],
  [500, "Rallye-Fahrer", "Rally driver"],
  [900, "Rennprofi", "Racing pro"],
  [1500, "Champion", "Champion"],
  [2500, "Legende", "Legend"],
  [4000, "Weltmeister", "World champion"],
];

/* Texte: Deutsch und Englisch (folgt der Sprache von Home Assistant) */
const RC_TEXTE = {
  de: {
    titel: "Familien-Rennen",
    fahrer: (n) => `Fahrer ${n}`,
    leer_keine: "Noch keine Personen mit Aufgabenliste eingerichtet.",
    leer_kein_rennen: "Kein Rennen gefunden. Ist der Familienplaner eingerichtet?",
    ziel: (z) => `Ziel ${z} Punkte`,
    beendet: "Rennen beendet",
    fuehrt: (n, f) => `${n} führt${f ? `, noch ${f} bis zur Ziellinie` : ""}`,
    erste: "Wer hakt die erste Aufgabe ab?",
    gewonnen: (n) => `${n} hat das Rennen gewonnen!`,
    tage: (n) => `${n} ${n === 1 ? "Tag" : "Tage"}`,
    heute: (n) => `heute ${n} ✓`,
    konto: (n) => `Konto ${n}`,
    punkte: "Punkte",
    punkte_von: (n, p) => `${n}: ${p} Punkte`,
    tippen: "Tippen: Fahrzeug und Farbe wählen",
    familienziel: (t) => `Gemeinsames Ziel: ${t}`,
    familien_belohnung: "Familien-Belohnung",
    garage: (n) => `Garage von ${n}`,
    garage_sub: "Fahrzeug und Farbe wählen",
    schliessen: "Schließen",
    fahrzeug: "Fahrzeug",
    farbe: "Farbe",
    bild: "Eigenes Bild",
    bild_ok: "Übernehmen",
    bild_weg: "Entfernen",
    bild_hint: "Bild nach /config/www/ legen und hier /local/… eintragen. Es ersetzt das Fahrzeug.",
  },
  en: {
    titel: "Family race",
    fahrer: (n) => `Driver ${n}`,
    leer_keine: "No people with a to-do list set up yet.",
    leer_kein_rennen: "No race found. Is Familienplaner set up?",
    ziel: (z) => `Finish ${z} points`,
    beendet: "Race finished",
    fuehrt: (n, f) => `${n} leads${f ? `, ${f} to the finish line` : ""}`,
    erste: "Who checks off the first task?",
    gewonnen: (n) => `${n} won the race!`,
    tage: (n) => `${n} ${n === 1 ? "day" : "days"}`,
    heute: (n) => `today ${n} ✓`,
    konto: (n) => `Account ${n}`,
    punkte: "Points",
    punkte_von: (n, p) => `${n}: ${p} points`,
    tippen: "Tap to choose vehicle and colour",
    familienziel: (t) => `Family goal: ${t}`,
    familien_belohnung: "Family reward",
    garage: (n) => `${n}'s garage`,
    garage_sub: "Choose vehicle and colour",
    schliessen: "Close",
    fahrzeug: "Vehicle",
    farbe: "Colour",
    bild: "Own picture",
    bild_ok: "Apply",
    bild_weg: "Remove",
    bild_hint: "Put a picture in /config/www/ and enter /local/… here. It replaces the vehicle.",
  },
};
const RC_NAMEN_EN = {
  Auto: "Car", Rennwagen: "Race car", Motorrad: "Motorbike", Pferd: "Horse", Einhorn: "Unicorn", Fahrrad: "Bicycle",
  Traktor: "Tractor", Rakete: "Rocket", Monstertruck: "Monster truck", "Hai-Truck": "Shark truck",
  "Dino-Truck": "Dino truck", "Blitz-Truck": "Lightning truck", "Polizei-Truck": "Police truck", "Feuerwehr-Truck": "Fire truck",
  "Bagger-Truck": "Digger truck", "Einhorn-Truck": "Unicorn truck", "Renn-Truck": "Racing truck", Blau: "Blue", Pink: "Pink", Orange: "Orange", "Grün": "Green", Rot: "Red",
  Gelb: "Yellow", Lila: "Purple", "Türkis": "Turquoise", Braun: "Brown", Grau: "Grey", Schwarz: "Black",
  "Weiß": "White", Gold: "Gold", Silber: "Silver",
};

function rcSprache(hass) {
  const l = (hass && ((hass.locale && hass.locale.language) || hass.language)) || "de";
  return String(l).toLowerCase().startsWith("de") ? "de" : "en";
}

function rcLevel(total, sprache = "de") {
  const spalte = sprache === "de" ? 1 : 2;
  let lvl = 1;
  let name = RC_LEVEL[0][spalte];
  let next = null;
  RC_LEVEL.forEach((eintrag, i) => {
    const min = eintrag[0];
    if (total >= min) {
      lvl = i + 1;
      name = eintrag[spalte];
      next = RC_LEVEL[i + 1] ? RC_LEVEL[i + 1][0] : null;
    }
  });
  return { lvl, name, next };
}

function rcFahrzeug(text) {
  const t = String(text || "").toLowerCase();
  if (t.startsWith("mdi:")) return { mdi: t };
  return RC_FAHRZEUGE.find((f) => t.includes(f.key)) || RC_FAHRZEUGE[RC_FAHRZEUGE.length - 1];
}

function rcFarbe(text, fallback) {
  const t = String(text || "").trim();
  if (/^#[0-9a-f]{3,8}$/i.test(t)) return t;
  const key = t.toLowerCase().split(/\s+/)[0];
  return RC_FARBEN[key] || fallback || "#8A8F96";
}

function rcEsc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function rcSvg(name, cls = "") {
  const d = RC_ICONS[name];
  if (!d) return "";
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
}

function rcVehicleSvg(f, bild) {
  if (bild) return `<img class="eigen" src="${rcEsc(bild)}" alt="" loading="lazy">`;
  if (f.svg) return f.svg;
  if (f.mdi) return `<ha-icon icon="${rcEsc(f.mdi)}"></ha-icon>`;
  const tf = [];
  if (f.flip) tf.push("scale(-1,1) translate(-24,0)");
  if (f.rotate) tf.push(`rotate(${f.rotate} 12 12)`);
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path transform="${tf.join(" ")}" d="${RC_ICONS[f.icon]}"/></svg>`;
}

function rcNum(hass, id, fallback = 0) {
  if (typeof id === "number") return id;
  const s = id && hass.states[id];
  const n = s ? parseFloat(s.state) : NaN;
  return isNaN(n) ? fallback : n;
}

class RennstreckeCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._prev = {};
    this._built = false;
    this._garage = null;
  }

  static getStubConfig() {
    return {};
  }

  setConfig(config) {
    config = config || {};
    // Zwei Betriebsarten:
    //  * Integration "Familienplaner": entity: sensor.familienplaner_familien_rennen (oder automatisch gefunden)
    //  * Eigene Helfer: Liste unter fahrer: (punkte/fahrzeug/farbe je Person als Entität oder fester Wert)
    this._entityMode = !Array.isArray(config.fahrer);
    if (!this._entityMode) {
      if (!config.fahrer.length) throw new Error("rennstrecke-card: Bitte unter 'fahrer:' mindestens eine Person eintragen.");
      config.fahrer.forEach((f, i) => {
        if (f.punkte === undefined) throw new Error(`rennstrecke-card: Bei Fahrer ${i + 1} fehlt 'punkte:'.`);
      });
    }
    this._rohConfig = config;
    this._config = { ziel: 500, ...config, fahrer: this._entityMode ? [] : config.fahrer };
    this._built = false;
    if (this._hass) this._update();
  }

  get _t() {
    return RC_TEXTE[rcSprache(this._hass)];
  }

  _label(o) {
    return rcSprache(this._hass) === "de" ? o : RC_NAMEN_EN[o] || o;
  }

  _findeEntity() {
    if (this._rohConfig.entity) return this._rohConfig.entity;
    const reg = this._hass.entities || {};
    const ids = Object.keys(this._hass.states).filter((id) => {
      const a = this._hass.states[id].attributes;
      return id.startsWith("sensor.") && Array.isArray(a.fahrer) && a.ziel !== undefined;
    });
    return ids.find((id) => reg[id] && reg[id].platform === "familienplaner") || ids[0];
  }

  /* Integration-Modus: Konfiguration aus den Attributen des Rennen-Sensors bauen */
  _sync() {
    if (!this._entityMode) return true;
    const id = this._findeEntity();
    const st = id && this._hass.states[id];
    this._eid = id;
    if (!st) return false;
    const a = st.attributes;
    const fahrer = (a.fahrer || []).map((f) => ({
      slug: f.slug,
      name: f.name,
      user_id: f.user_id,
      punkte: Number(f.punkte) || 0,
      fahrzeug: f.fahrzeug,
      farbe: f.farbe_hex || f.farbe,
      farbeName: f.farbe,
      serie: Number(f.serie) || 0,
      heute: Number(f.heute) || 0,
      gesamt: Number(f.gesamt) || 0,
      konto: Number(f.konto) || 0,
      bild: f.bild || null,
    }));
    if (fahrer.length !== this._config.fahrer.length || fahrer.some((f, i) => f.slug !== this._config.fahrer[i].slug)) {
      this._built = false;
    }
    this._optionen = { fahrzeuge: a.fahrzeuge || [], farben: Object.keys(a.farben || {}) };
    this._config = {
      ...this._rohConfig,
      ziel: Number(a.ziel) || 500,
      sieger: a.sieger || "",
      familienziel: a.familienziel ? Number(a.familienziel) : undefined,
      familienpunkte: a.familienziel ? Number(a.familienpunkte) || 0 : undefined,
      familienziel_text: a.familienziel_text || "",
      fahrer,
    };
    return fahrer.length > 0;
  }

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    if (!this._config) return;
    if (!old || !this._built || this._relevantChanged(old, hass)) this._update();
  }

  getCardSize() {
    return 3 + Math.max(2, this._config.fahrer.length);
  }

  getGridOptions() {
    return { columns: "full", rows: "auto", min_columns: 6 };
  }

  _entities() {
    const c = this._config;
    const ids = [c.ziel, c.sieger, c.familienziel, c.familienpunkte, c.familienziel_text];
    c.fahrer.forEach((f) => ids.push(f.punkte, f.fahrzeug, f.farbe, f.serie, f.heute, f.gesamt, f.konto, f.person));
    return ids.filter((x) => typeof x === "string" && x.includes("."));
  }

  _relevantChanged(a, b) {
    if (a.themes !== b.themes) return true;
    if (this._entityMode) return !this._eid || a.states[this._eid] !== b.states[this._eid];
    return this._entities().some((id) => a.states[id] !== b.states[id]);
  }

  _state(id) {
    if (!id || typeof id !== "string") return undefined;
    if (!id.includes(".")) return id; // fester Wert statt Entität
    const s = this._hass.states[id];
    return s ? s.state : undefined;
  }

  _darf(f) {
    const u = this._hass.user;
    if (this._entityMode) return !!(u && (u.is_admin || (f.user_id && f.user_id === u.id)));
    if (!f.fahrzeug || !String(f.fahrzeug).includes(".")) return false;
    if (this._config.garage_fuer_alle || !f.person) return true;
    if (u && u.is_admin && this._config.admin_darf_alles !== false) return true;
    const p = this._hass.states[f.person];
    return !!(u && p && p.attributes.user_id === u.id);
  }

  _daten() {
    const hass = this._hass;
    const c = this._config;
    const ziel = Math.max(1, rcNum(hass, c.ziel, 500));
    const fahrer = c.fahrer.map((f, i) => {
      const punkte = Math.max(0, rcNum(hass, f.punkte, 0));
      const fzText = this._state(f.fahrzeug) || f.fahrzeug || "Auto";
      const farbeText = f.farbeName || this._state(f.farbe) || f.farbe;
      const personName = f.person && hass.states[f.person] ? hass.states[f.person].attributes.friendly_name : null;
      const gesamt = f.gesamt ? rcNum(hass, f.gesamt, 0) : null;
      return {
        i,
        cfg: f,
        name: f.name || personName || this._t.fahrer(i + 1),
        punkte,
        pct: Math.min(1, punkte / ziel),
        fz: rcFahrzeug(fzText),
        fzText,
        farbe: rcFarbe(f.farbeName ? f.farbe : farbeText, ["#5B8DB8", "#D9849B", "#E39350", "#6FA372"][i % 4]),
        farbeText,
        serie: f.serie ? rcNum(hass, f.serie, 0) : null,
        heute: f.heute ? rcNum(hass, f.heute, 0) : null,
        konto: f.konto ? rcNum(hass, f.konto, 0) : null,
        level: gesamt !== null ? { ...rcLevel(gesamt, rcSprache(hass)), gesamt } : null,
        darf: this._darf(f),
        bild: f.bild && /^(\/local\/|\/media\/|\/api\/|https:\/\/)[^\s"'<>]+$/.test(f.bild) ? f.bild : null,
      };
    });
    const max = Math.max(...fahrer.map((f) => f.punkte));
    fahrer.forEach((f) => (f.fuehrt = max > 0 && f.punkte === max));
    const rang = [...fahrer].sort((a, b) => b.punkte - a.punkte);
    rang.forEach((f, idx) => (f.platz = idx === 0 || f.punkte < rang[idx - 1].punkte ? idx + 1 : rang[idx - 1].platz));
    const sieger = (this._state(c.sieger) || "").trim();
    return { ziel, fahrer, rang, sieger };
  }

  _build() {
    const c = this._config;
    const lanes = c.fahrer
      .map(
        (_, i) => `
        <div class="lane" data-i="${i}">
          <div class="lane-name"></div>
          <div class="runway">
            <div class="car" data-i="${i}">
              <div class="tag"><span class="crown">${rcSvg("krone")}</span><span class="tag-txt"></span></div>
              <div class="body"></div>
              <div class="shadow"></div>
            </div>
          </div>
        </div>`
      )
      .join("");
    const chips = c.fahrer
      .map(
        (_, i) => `
        <button class="chip" data-i="${i}">
          <span class="chip-car"></span>
          <span class="chip-main"><b class="chip-name"></b><small class="chip-sub"></small></span>
          <span class="chip-pts"></span>
        </button>`
      )
      .join("");

    this.shadowRoot.innerHTML = `
      <style>${RennstreckeCard.styles}</style>
      <ha-card>
        <div class="head">
          <div>
            <div class="title"></div>
            <div class="sub"></div>
          </div>
          <div class="flag">${rcSvg("flagge")}</div>
        </div>
        <div class="banner" hidden>${rcSvg("pokal")}<span></span></div>
        <div class="track">
          <div class="kerb top"></div>
          <div class="asphalt">
            <div class="start"></div>
            <div class="finish"></div>
            ${lanes}
          </div>
          <div class="kerb bottom"></div>
        </div>
        <div class="chips">${chips}</div>
        <div class="family" hidden>
          <div class="family-row"><span class="family-txt"></span><b class="family-num"></b></div>
          <div class="bar"><div class="fill"></div></div>
        </div>
        <div class="fx"></div>
        <div class="garage" hidden></div>
      </ha-card>`;

    this.shadowRoot.querySelectorAll(".chip, .car").forEach((el) =>
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const i = Number(el.dataset.i);
        const f = this._config.fahrer[i];
        if (this._darf(f)) this._openGarage(i);
        else if (this._entityMode && this._eid) this._moreInfo(this._eid);
        else if (f.punkte && String(f.punkte).includes(".")) this._moreInfo(f.punkte);
      })
    );
    this._built = true;
  }

  _update() {
    if (!this._hass || !this._config) return;
    if (!this._sync()) {
      this._built = false;
      this.shadowRoot.innerHTML = `<style>${RennstreckeCard.styles}</style><ha-card><div class="leer">${rcSvg("flagge")}
        <b>${rcEsc(this._config.title || this._t.titel)}</b><span>${this._eid ? this._t.leer_keine : this._t.leer_kein_rennen}</span></div></ha-card>`;
      return;
    }
    if (!this._built) this._build();
    const root = this.shadowRoot;
    const c = this._config;
    const d = this._daten();
    const t = this._t;

    root.querySelector(".title").textContent = c.title || t.titel;
    const leader = d.rang[0];
    const fehlt = Math.max(0, Math.ceil(d.ziel - leader.punkte));
    root.querySelector(".sub").textContent =
      leader.punkte > 0
        ? d.sieger
          ? `${t.ziel(d.ziel)} · ${t.beendet}`
          : `${t.ziel(d.ziel)} · ${t.fuehrt(leader.name, fehlt)}`
        : `${t.ziel(d.ziel)} · ${t.erste}`;

    const banner = root.querySelector(".banner");
    banner.hidden = !d.sieger;
    banner.querySelector("span").textContent = d.sieger ? t.gewonnen(d.sieger) : "";
    if (d.sieger && this._prev.sieger !== undefined && this._prev.sieger !== d.sieger) this._confetti(40);
    this._prev.sieger = d.sieger;

    d.fahrer.forEach((f) => {
      const lane = root.querySelector(`.lane[data-i="${f.i}"]`);
      lane.querySelector(".lane-name").textContent = f.name;
      const car = lane.querySelector(".car");
      car.style.setProperty("--pct", f.pct);
      car.style.setProperty("--c", f.farbe);
      car.classList.toggle("gallop", !!f.fz.gallop);
      car.classList.toggle("leader", f.fuehrt);
      car.classList.toggle("finished", f.pct >= 1);
      car.title = t.punkte_von(f.name, f.punkte);
      const key = `${f.fzText}|${f.farbe}|${f.bild}`;
      if (car.dataset.key !== key) {
        car.querySelector(".body").innerHTML = rcVehicleSvg(f.fz, f.bild);
        car.dataset.key = key;
      }
      car.querySelector(".tag-txt").textContent = `${f.name} · ${Math.round(f.punkte)}`;

      const prev = this._prev[f.i];
      if (prev !== undefined && f.punkte > prev) {
        this._float(car, `+${Math.round(f.punkte - prev)}`, f.farbe);
        car.classList.remove("boost");
        void car.offsetWidth;
        car.classList.add("boost");
        if (prev < d.ziel && f.punkte >= d.ziel) this._confetti(60);
      }
      this._prev[f.i] = f.punkte;

      const chip = root.querySelector(`.chip[data-i="${f.i}"]`);
      chip.style.setProperty("--c", f.farbe);
      chip.classList.toggle("can-edit", f.darf);
      chip.querySelector(".chip-car").innerHTML = rcVehicleSvg(f.fz, f.bild);
      chip.querySelector(".chip-name").textContent = `${f.platz}. ${f.name}`;
      const sub = [];
      if (f.level) sub.push(`Lv ${f.level.lvl} ${f.level.name}`);
      if (f.serie) sub.push(`🔥 ${t.tage(f.serie)}`);
      if (f.heute !== null) sub.push(t.heute(f.heute));
      chip.querySelector(".chip-sub").textContent = sub.join(" · ");
      chip.querySelector(".chip-pts").innerHTML =
        `${Math.round(f.punkte)}<small>${f.konto !== null ? t.konto(Math.round(f.konto)) : t.punkte}</small>`;
      chip.title = f.darf ? t.tippen : t.punkte_von(f.name, f.punkte);
    });

    // Gemeinsames Familienziel
    const fam = root.querySelector(".family");
    if (c.familienziel && c.familienpunkte) {
      const zielF = Math.max(1, rcNum(this._hass, c.familienziel, 1000));
      const istF = rcNum(this._hass, c.familienpunkte, 0);
      const text = this._state(c.familienziel_text) || t.familien_belohnung;
      fam.hidden = false;
      fam.querySelector(".family-txt").textContent = t.familienziel(text);
      fam.querySelector(".family-num").textContent = `${Math.round(istF)} / ${Math.round(zielF)}`;
      fam.querySelector(".fill").style.width = `${Math.min(100, (istF / zielF) * 100)}%`;
      fam.classList.toggle("done", istF >= zielF);
    } else fam.hidden = true;

    if (this._garage !== null) this._renderGarage();
  }

  _float(car, text, color) {
    const fx = this.shadowRoot.querySelector(".fx");
    const r = car.getBoundingClientRect();
    const host = this.shadowRoot.querySelector("ha-card").getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "plus";
    el.textContent = text;
    el.style.left = `${r.left - host.left + r.width / 2}px`;
    el.style.top = `${r.top - host.top}px`;
    el.style.color = color;
    fx.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  _confetti(n) {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const fx = this.shadowRoot.querySelector(".fx");
    const farben = this._daten().fahrer.map((f) => f.farbe).concat(["#E5BE3C", "#ffffff"]);
    for (let k = 0; k < n; k++) {
      const el = document.createElement("i");
      el.className = "confetti";
      el.style.left = `${Math.random() * 100}%`;
      el.style.background = farben[k % farben.length];
      el.style.animationDelay = `${Math.random() * 0.4}s`;
      el.style.setProperty("--dx", `${(Math.random() - 0.5) * 160}px`);
      el.style.setProperty("--rot", `${Math.random() * 720}deg`);
      fx.appendChild(el);
      setTimeout(() => el.remove(), 2600);
    }
  }

  _moreInfo(entityId) {
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  _openGarage(i) {
    this._garage = i;
    this._renderGarage();
  }

  _closeGarage() {
    this._garage = null;
    const g = this.shadowRoot.querySelector(".garage");
    g.hidden = true;
    g.innerHTML = "";
  }

  _renderGarage() {
    const t = this._t;
    const i = this._garage;
    const f = this._config.fahrer[i];
    const d = this._daten().fahrer[i];
    const g = this.shadowRoot.querySelector(".garage");
    let fzOpts = [];
    let faOpts = [];
    if (this._entityMode) {
      fzOpts = (this._optionen && this._optionen.fahrzeuge) || [];
      faOpts = (this._optionen && this._optionen.farben) || [];
    } else {
      const fzState = this._hass.states[f.fahrzeug];
      const faState = f.farbe && this._hass.states[f.farbe];
      fzOpts = fzState ? fzState.attributes.options || [] : [];
      faOpts = faState ? faState.attributes.options || [] : [];
    }

    g.innerHTML = `
      <div class="g-box" role="dialog" aria-label="${rcEsc(t.garage(d.name))}">
        <div class="g-head">
          <div class="g-preview" style="--c:${d.farbe}">${rcVehicleSvg(d.fz, d.bild)}</div>
          <div><b>${rcEsc(t.garage(d.name))}</b><small>${t.garage_sub}</small></div>
          <button class="g-close" aria-label="${t.schliessen}">${rcSvg("schliessen")}</button>
        </div>
        <div class="g-label">${t.fahrzeug}</div>
        <div class="g-grid">
          ${fzOpts
            .map((o) => {
              const sel = o === d.fzText;
              return `<button class="g-opt ${sel ? "sel" : ""}" data-fz="${rcEsc(o)}" style="--c:${d.farbe}">
                ${rcVehicleSvg(rcFahrzeug(o))}<span>${rcEsc(this._label(o))}</span></button>`;
            })
            .join("")}
        </div>
        ${
          faOpts.length
            ? `<div class="g-label">${t.farbe}</div>
        <div class="g-colors">
          ${faOpts
            .map((o) => {
              const sel = o === d.farbeText;
              return `<button class="g-col ${sel ? "sel" : ""}" data-fa="${rcEsc(o)}" style="--c:${rcFarbe(o)}" title="${rcEsc(this._label(o))}">
                ${sel ? rcSvg("haken") : ""}</button>`;
            })
            .join("")}
        </div>`
            : ""
        }
        ${
          this._entityMode
            ? `<div class="g-label">${t.bild}</div>
        <div class="g-bild">
          <input type="text" inputmode="url" placeholder="/local/familienplaner/name.png" value="${rcEsc(d.bild || "")}" aria-label="${t.bild}">
          <button class="g-btn ok">${t.bild_ok}</button>
          ${d.bild ? `<button class="g-btn weg">${t.bild_weg}</button>` : ""}
        </div>
        <small class="g-hint">${t.bild_hint}</small>`
            : ""
        }
      </div>`;
    g.hidden = false;
    g.onclick = (ev) => {
      if (ev.target === g) this._closeGarage();
    };
    g.querySelector(".g-close").onclick = () => this._closeGarage();
    g.querySelectorAll(".g-opt").forEach((b) => (b.onclick = () => this._select(f, "fahrzeug", b.dataset.fz)));
    g.querySelectorAll(".g-col").forEach((b) => (b.onclick = () => this._select(f, "farbe", b.dataset.fa)));
    const feld = g.querySelector(".g-bild input");
    if (feld) {
      g.querySelector(".g-btn.ok").onclick = () => this._select(f, "bild", feld.value.trim());
      const weg = g.querySelector(".g-btn.weg");
      if (weg) weg.onclick = () => this._select(f, "bild", "");
    }
  }

  _select(f, feld, option) {
    if (this._entityMode) {
      this._hass.callService("familienplaner", "fahrzeug_waehlen", { person: f.slug, [feld]: option });
    } else {
      this._hass.callService("input_select", "select_option", { entity_id: f[feld], option });
    }
  }
}

RennstreckeCard.styles = `
  .eigen { width: 52px; height: 52px; object-fit: contain; filter: drop-shadow(0 2px 2px rgba(0,0,0,.35)); }
  .chip-car .eigen { width: 30px; height: 30px; }
  .g-preview .eigen { width: 40px; height: 40px; }
  .car.gallop .body .eigen { animation: gallop .55s ease-in-out infinite; transform-origin: 50% 100%; }
  .g-bild { display:flex; gap: 8px; flex-wrap: wrap; }
  .g-bild input { flex: 1 1 180px; min-width: 0; font: inherit; padding: 9px 12px; border-radius: 12px;
    border: 1px solid var(--divider-color, #ccc); background: var(--card-background-color, #fff); color: var(--primary-text-color); }
  .g-btn { font: inherit; font-weight: 700; padding: 9px 14px; border-radius: 12px; border: none; cursor: pointer;
    background: var(--primary-color); color: #fff; }
  .g-btn.weg { background: color-mix(in srgb, var(--secondary-text-color) 15%, transparent); color: var(--primary-text-color); }
  .g-hint { display:block; margin-top: 6px; color: var(--secondary-text-color); font-size: 12px; }
  :host { --asph: #5A5651; --asph2: #514D48; --kerb1: #C8665A; --kerb2: #F3EDE3; --grass: #A9C49A; display:block; }
  ha-card { display: block; position: relative; overflow: hidden; padding: 18px 18px 16px; }
  .head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom: 12px; }
  .title { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; color: var(--primary-text-color); }
  .sub { font-size: 14px; color: var(--secondary-text-color); margin-top: 2px; }
  .leer { display:flex; flex-direction:column; align-items:center; gap:6px; padding: 18px; text-align:center; color: var(--secondary-text-color); }
  .leer svg { width: 36px; height: 36px; fill: currentColor; opacity: .5; }
  .leer b { color: var(--primary-text-color); font-size: 16px; }
  .flag svg { width: 30px; height: 30px; fill: var(--secondary-text-color); opacity: .55; }
  .banner { display:flex; align-items:center; gap:10px; padding:10px 14px; margin: 0 0 12px; border-radius: 14px;
    background: color-mix(in srgb, #E5BE3C 22%, transparent); color: var(--primary-text-color); font-weight: 700; }
  .banner[hidden] { display:none; }
  .banner svg { width: 26px; height: 26px; fill: #C9A227; flex: none; }

  .track { border-radius: 20px; background: var(--grass); padding: 8px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.04); }
  .kerb { height: 7px; border-radius: 4px;
    background: repeating-linear-gradient(90deg, var(--kerb1) 0 14px, var(--kerb2) 14px 28px); }
  .asphalt { position: relative; margin: 4px 0; border-radius: 10px; padding: 0 26px 0 0;
    background: linear-gradient(180deg, var(--asph), var(--asph2)); }
  .start { position:absolute; top:0; bottom:0; left: 64px; width: 3px; background: rgba(255,255,255,.55); }
  .finish { position:absolute; top:0; bottom:0; right:0; width: 22px; border-radius: 0 10px 10px 0;
    background: conic-gradient(#fff 0 25%, #2b2926 0 50%, #fff 0 75%, #2b2926 0) 0 0 / 11px 11px; opacity:.9; }
  .lane { position: relative; height: 70px; display:flex; align-items:center; }
  .lane + .lane::before { content:""; position:absolute; left: 8px; right: 0; top: 0; height: 2px;
    background: repeating-linear-gradient(90deg, rgba(255,255,255,.45) 0 18px, transparent 18px 34px); }
  .lane-name { position:absolute; left: 8px; width: 52px; font-size: 11px; font-weight: 800; letter-spacing: .6px;
    text-transform: uppercase; color: rgba(255,255,255,.55); overflow:hidden; text-overflow: ellipsis; white-space: nowrap; }
  .runway { position:absolute; left: 50px; right: 30px; top:0; bottom:0; }
  .car { position:absolute; bottom: 4px; width: 54px; height: 64px; cursor: pointer;
    left: calc(var(--pct, 0) * (100% - 54px));
    transition: left 1.6s cubic-bezier(.22,.9,.25,1); -webkit-tap-highlight-color: transparent; }
  .car .body { position:absolute; left:-4px; right:-4px; bottom: 3px; height: 48px; display:flex; align-items:flex-end; justify-content:center; }
  .car .body svg, .car .body ha-icon { width: 52px; height: 52px; --mdc-icon-size: 52px; color: var(--c);
    fill: var(--c); stroke: rgba(255,255,255,.9); stroke-width: .6px; paint-order: stroke; stroke-linejoin: round;
    filter: drop-shadow(0 2px 2px rgba(0,0,0,.35)); }
  .car .shadow { position:absolute; left: 6px; right: 6px; bottom: 2px; height: 5px; border-radius: 50%; background: rgba(0,0,0,.28); }
  .car .tag { position:absolute; left: 50%; top: -2px; transform: translateX(-50%); white-space: nowrap;
    background: var(--c); color: #fff; font-size: 10.5px; font-weight: 800; padding: 1px 7px; border-radius: 9px;
    box-shadow: 0 1px 3px rgba(0,0,0,.25); display:flex; align-items:center; gap:3px; z-index: 2; }
  .car .crown { display:none; }
  .car.leader .crown { display:inline-flex; }
  .crown svg { width: 11px; height: 11px; fill: #FFD75E; }
  .car.leader { z-index: 3; }
  .car.gallop .body svg { animation: gallop .55s ease-in-out infinite; transform-origin: 50% 100%; }
  .car.boost .body { animation: boost .9s ease-out; }
  .car.finished .body svg { filter: drop-shadow(0 0 6px rgba(255,215,94,.9)) drop-shadow(0 2px 2px rgba(0,0,0,.35)); }
  @keyframes gallop { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-3px) rotate(-4deg); } }
  @keyframes boost { 0% { transform: translateX(0); } 30% { transform: translateX(4px) scale(1.08); } 100% { transform: none; } }

  .chips { display:grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 8px; margin-top: 14px; }
  .chip { all: unset; box-sizing: border-box; display:flex; align-items:center; gap:10px; padding: 8px 12px 8px 8px; border-radius: 16px;
    background: color-mix(in srgb, var(--c) 12%, var(--card-background-color, #fff)); cursor: default; min-width: 0; }
  .chip.can-edit { cursor: pointer; }
  .chip.can-edit:hover { background: color-mix(in srgb, var(--c) 20%, var(--card-background-color, #fff)); }
  .chip:focus-visible { outline: 2px solid var(--c); }
  .chip-car { flex:none; width: 38px; height: 38px; border-radius: 12px; display:grid; place-items:center;
    background: color-mix(in srgb, var(--c) 22%, transparent); }
  .chip-car svg, .chip-car ha-icon { width: 26px; height: 26px; --mdc-icon-size: 26px; fill: var(--c); color: var(--c); }
  .chip-main { display:flex; flex-direction:column; min-width:0; flex:1; }
  .chip-name { font-size: 14px; color: var(--primary-text-color); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .chip-sub { font-size: 11.5px; line-height: 1.3; color: var(--secondary-text-color); }
  .chip-pts { font-size: 18px; font-weight: 800; color: var(--primary-text-color); text-align:right; line-height: 1.05; display:flex; flex-direction:column; }
  .chip-pts small { font-size: 10px; font-weight: 600; color: var(--secondary-text-color); }

  .family { margin-top: 14px; }
  .family[hidden] { display:none; }
  .family-row { display:flex; justify-content:space-between; gap: 10px; font-size: 13px; color: var(--secondary-text-color); margin-bottom: 6px; }
  .family-num { color: var(--primary-text-color); }
  .bar { height: 10px; border-radius: 6px; background: var(--secondary-background-color, #EFEAE1); overflow:hidden; }
  .fill { height: 100%; border-radius: 6px; transition: width 1.2s ease;
    background: linear-gradient(90deg, #5B8DB8, #D9849B, #E39350, #6FA372); }
  .family.done .family-num::after { content: " 🎉"; }

  .fx { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
  .plus { position:absolute; transform: translate(-50%, 0); font-weight: 900; font-size: 18px;
    text-shadow: 0 1px 0 #fff, 0 0 6px rgba(255,255,255,.8); animation: plus 1.6s ease-out forwards; }
  @keyframes plus { 0% { opacity:0; transform: translate(-50%, 6px) scale(.8); } 15% { opacity:1; transform: translate(-50%, -6px) scale(1.15); }
    100% { opacity:0; transform: translate(-50%, -38px) scale(1); } }
  .confetti { position:absolute; top:-12px; width: 8px; height: 12px; border-radius: 2px; animation: fall 2.4s cubic-bezier(.2,.6,.4,1) forwards; }
  @keyframes fall { to { transform: translate(var(--dx), 420px) rotate(var(--rot)); opacity: 0; } }

  .garage { position:absolute; inset:0; z-index: 10; display:flex; align-items:center; justify-content:center; padding: 12px;
    background: color-mix(in srgb, var(--card-background-color, #fff) 55%, transparent); backdrop-filter: blur(4px); }
  .garage[hidden] { display:none; }
  .g-box { width: min(440px, 100%); max-height: 100%; overflow:auto; background: var(--card-background-color, #fff);
    border-radius: 20px; padding: 16px; box-shadow: 0 10px 40px rgba(0,0,0,.2); }
  .g-head { display:flex; align-items:center; gap: 12px; margin-bottom: 6px; }
  .g-head b { display:block; font-size: 16px; color: var(--primary-text-color); }
  .g-head small { color: var(--secondary-text-color); font-size: 12px; }
  .g-head > div:nth-child(2) { flex:1; }
  .g-preview { width: 48px; height: 48px; border-radius: 14px; display:grid; place-items:center; background: color-mix(in srgb, var(--c) 20%, transparent); }
  .g-preview svg, .g-preview ha-icon { width: 34px; height: 34px; --mdc-icon-size: 34px; fill: var(--c); color: var(--c); }
  .g-close { all: unset; cursor:pointer; width: 36px; height: 36px; border-radius: 50%; display:grid; place-items:center; }
  .g-close:hover { background: var(--secondary-background-color); }
  .g-close svg { width: 22px; height: 22px; fill: var(--secondary-text-color); }
  .g-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: var(--secondary-text-color); margin: 12px 0 8px; }
  .g-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(86px, 1fr)); gap: 8px; }
  .g-opt { all: unset; cursor:pointer; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; gap: 4px;
    padding: 10px 4px 8px; border-radius: 14px; background: var(--secondary-background-color, #EFEAE1); font-size: 12px; color: var(--primary-text-color); }
  .g-opt svg, .g-opt ha-icon { width: 32px; height: 32px; --mdc-icon-size: 32px; fill: var(--c); color: var(--c); }
  .g-opt.sel { box-shadow: inset 0 0 0 2px var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); font-weight: 700; }
  .g-colors { display:flex; flex-wrap:wrap; gap: 10px; }
  .g-col { all: unset; cursor:pointer; width: 36px; height: 36px; border-radius: 50%; background: var(--c); display:grid; place-items:center;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.12); }
  .g-col.sel { box-shadow: 0 0 0 3px var(--card-background-color, #fff), 0 0 0 5px var(--c); }
  .g-col svg { width: 20px; height: 20px; fill: #fff; filter: drop-shadow(0 0 1px rgba(0,0,0,.6)); }

  @media (max-width: 480px) {
    ha-card { padding: 14px 12px 12px; }
    .lane { height: 62px; }
    .lane-name { display: none; }
    .start { left: 12px; }
    .runway { left: 4px; right: 26px; }
    .car { width: 46px; height: 58px; left: calc(var(--pct, 0) * (100% - 46px)); }
    .car .body { height: 42px; }
    .car .body svg, .car .body ha-icon { width: 44px; height: 44px; --mdc-icon-size: 44px; }
    .chips { grid-template-columns: 1fr; }
  }
  @media (prefers-reduced-motion: reduce) {
    .car, .fill { transition: none; }
    .car.gallop .body svg, .car.boost .body { animation: none; }
  }
`;

if (!customElements.get("rennstrecke-card")) {
  customElements.define("rennstrecke-card", RennstreckeCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "rennstrecke-card",
    name: "Rennstrecke (Familien-Punkte)",
    description: "Zeigt die Familie als Fahrzeuge auf einer Rennstrecke, Position nach Punkten.",
    preview: false,
  });
  console.info(`%c RENNSTRECKE-CARD %c ${RC_VERSION} `, "background:#5B8DB8;color:#fff;font-weight:700", "background:#E39350;color:#fff");
}
