// Shared helpers for the Cliamp launcher button and the floating player.
import { exec, focused, terminals } from "herdr";

// Both are looked up on PATH (mods run in the user's real environment).
export const BIN = "cliamp";
export const APP = () => "herdr-app";

// Providers cliamp can start with --provider. `hot` ones are shown first.
export const PROVIDERS = [
  { id: "netease", name: "网易云音乐", hot: true },
  { id: "ytmusic", name: "YouTube Music", hot: true },
  { id: "radio", name: "网络电台", hot: true },
  { id: "cliamp", name: "本地音乐", hot: true },
  { id: "spotify", name: "Spotify" },
  { id: "qobuz", name: "Qobuz" },
  { id: "tidal", name: "Tidal" },
  { id: "bandcamp", name: "Bandcamp" },
  { id: "soundcloud", name: "SoundCloud" },
  { id: "mixcloud", name: "Mixcloud" },
  { id: "podcast", name: "播客" },
  { id: "navidrome", name: "Navidrome" },
  { id: "plex", name: "Plex" },
  { id: "jellyfin", name: "Jellyfin" },
  { id: "emby", name: "Emby" },
  { id: "yandex", name: "Yandex Music" },
];

// The live terminal of the "♪ Cliamp" tab this mod opened, or null. (hc doesn't report argv,
// so the tab's name is the marker; the shell may outlive cliamp, so use snapshot() for "playing".)
export function cliampTerminal() {
  return terminals().find((t) => t.state === "live" && typeof t.where === "string" && t.where.endsWith("/ ♪ Cliamp")) ?? null;
}

// Playback snapshot from the running cliamp, or null when it isn't running.
export async function snapshot() {
  try {
    const r = await exec(BIN, ["remote", "state"], { timeout: 3000 });
    if (r.code !== 0) return null;
    return JSON.parse(r.stdout).snapshot ?? null;
  } catch { return null; }
}

export async function ctl(...args) {
  try { return await exec(BIN, args, { timeout: 5000 }); } catch { return null; }
}

// Opens a "♪ Cliamp" tab in the space on screen and starts cliamp with the provider.
export async function launch(provider) {
  const space = focused()?.space;
  const args = ["do", "tab.new", "--name", "♪ Cliamp", "--argv", JSON.stringify([BIN, "--provider", provider, "--auto-play"])];
  if (space) args.push("--space", space);
  const r = await exec(APP(), args, { timeout: 8000 });
  return r.stdout;
}

// Visualizer modes (`cliamp vis list`); this list is the fallback if the call fails.
export const VIS_FALLBACK = ["Bars", "BarsDot", "Rain", "BarsOutline", "Bricks", "Columns", "ClassicPeak", "Wave", "Scatter", "Flame", "Retro", "Pulse", "Matrix", "Binary", "Sakura", "Firework", "Bubbles", "Logo", "Terrain", "Scope", "Heartbeat", "Butterfly", "Ascii", "Firefly", "Mosaic", "Sand", "Geyser", "ClassicLED", "Stereo", "Mirror", "Omarchy", "RedSector", "YinYang", "Ethereal", "None"];

export async function visModes() {
  const r = await ctl("vis", "list");
  const names = (r?.stdout ?? "").split("\n").map((l) => l.replace(/^\*?\s*/, "").trim()).filter(Boolean);
  return names.length ? names : VIS_FALLBACK;
}
