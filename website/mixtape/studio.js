"use strict";
const byId = (id) => document.getElementById(id);
const starter = {
  title: "After the rain",
  tracks: ["sO8_NGzO39g", "bA9qpIB8xQM", "3f5KfgdY8BM"],
};
const names = new Map([
  ["sO8_NGzO39g", "Paul Desmond — Bossa Antigua"],
  ["bA9qpIB8xQM", "Grant Green — Django"],
  ["3f5KfgdY8BM", "Matthew Halsall — The Sun in September"],
]);
const videoId = /^[A-Za-z0-9_-]{11}$/;
const youtubeHosts = new Set(["www.youtube.com", "youtube.com", "m.youtube.com", "music.youtube.com"]);
let mix;

function readId(token) {
  if (videoId.test(token)) return token;
  let url;
  try {
    url = new URL(token.includes("://") ? token : "https://" + token);
  } catch {
    return null;
  }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port) return null;
  let id = "";
  if (url.hostname === "youtu.be") id = url.pathname.slice(1);
  if (youtubeHosts.has(url.hostname)) {
    if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
    else id = /^\/(?:shorts|embed|live)\/([^/]+)\/?$/.exec(url.pathname)?.[1] || "";
  }
  return videoId.test(id) ? id : null;
}

function readTracks(raw) {
  const tokens = raw.trim().split(/[\s,]+/).filter(Boolean);
  if (!tokens.length || tokens.length > 30) throw new Error("Enter between 1 and 30 tracks.");
  return tokens.map((token, index) => {
    const id = readId(token);
    if (!id) throw new Error("Check track " + (index + 1) + ". Use a YouTube video link or an 11-character video ID.");
    return id;
  });
}

function fragment(selection) {
  return "#title=" + encodeURIComponent(selection.title) + "&tracks=" + selection.tracks.join(",");
}

function render(selection, editorial = false) {
  mix = selection;
  byId("player").replaceChildren();
  byId("cover").hidden = false;
  byId("play").textContent = "Play mix";
  byId("mix-title").textContent = mix.title;
  byId("source").textContent = editorial ? "Studio selection" : "YouTube mix";
  byId("summary").textContent = editorial ? "Three instrumental jazz recordings · 21:18" : mix.tracks.length + (mix.tracks.length === 1 ? " track" : " tracks");
  byId("name").value = mix.title;
  byId("tracks").value = mix.tracks.join("\n");
  byId("share-url").hidden = true;
  byId("share-status").textContent = "";
  byId("edit-status").textContent = "";
  byId("tracklist").replaceChildren(...mix.tracks.map((id) => {
    const row = document.createElement("li");
    const link = document.createElement("a");
    link.href = "https://www.youtube.com/watch?v=" + id;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = names.get(id) || "Watch " + id + " on YouTube";
    row.append(link);
    return row;
  }));
}

function loadLocation() {
  if (!location.hash) return render(starter, true);
  const params = new URLSearchParams(location.hash.slice(1));
  try {
    const tracks = (params.get("tracks") || "").split(",");
    if (tracks.length > 30 || tracks.some((id) => !videoId.test(id))) {
      throw new Error("A shared mix needs 1–30 valid video IDs.");
    }
    const title = (params.get("title") || "").trim().slice(0, 120) || "Untitled mix";
    render({ title, tracks });
  } catch (error) {
    render(starter, true);
    byId("edit-status").textContent = "This preview link is invalid. Showing the studio selection. " + error.message;
  }
}

byId("editor").addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const tracks = readTracks(byId("tracks").value);
    const title = byId("name").value.trim() || "Untitled mix";
    const selection = { title, tracks };
    history.replaceState(null, "", fragment(selection));
    render(selection);
    byId("edit-status").textContent = "Preview ready.";
  } catch (error) {
    byId("edit-status").textContent = error.message;
  }
});

byId("play").addEventListener("click", () => {
  const frame = document.createElement("iframe");
  const src = new URL("https://www.youtube-nocookie.com/embed/" + mix.tracks[0]);
  src.searchParams.set("autoplay", "1");
  src.searchParams.set("playsinline", "1");
  if (mix.tracks.length > 1) src.searchParams.set("playlist", mix.tracks.join(","));
  frame.src = src.href;
  frame.title = mix.title + " — YouTube player";
  frame.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
  frame.allowFullscreen = true;
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  byId("cover").hidden = true;
  byId("player").replaceChildren(frame);
  byId("play").textContent = "Restart mix";
});

byId("share").addEventListener("click", async () => {
  const url = "https://sidecourt.space/mixtape/" + fragment(mix);
  try {
    await navigator.clipboard.writeText(url);
    byId("share-status").textContent = "Preview link copied.";
  } catch {
    const input = byId("share-url");
    input.hidden = false;
    input.value = url;
    input.focus();
    input.select();
    byId("share-status").textContent = "Copy the selected preview link.";
  }
});

window.addEventListener("hashchange", loadLocation);
loadLocation();
