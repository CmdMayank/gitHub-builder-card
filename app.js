// Builder Card
// Enter a GitHub username -> profile, top repos, main languages, recent activity.
// No backend: the browser calls the public GitHub REST API directly.

const API = "https://api.github.com";

const form = document.getElementById("search-form");
const input = document.getElementById("username");
const statusEl = document.getElementById("status");
const card = document.getElementById("card");
const profileEl = document.getElementById("profile");
const reposEl = document.getElementById("repos");
const languagesEl = document.getElementById("languages");
const activityEl = document.getElementById("activity");
const button = form.querySelector("button");

// ---------- helpers ----------

// Show a message under the form; isError turns it red
function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

// "3 days ago" from an ISO date string
function timeAgo(dateString) {
  const seconds = Math.floor((Date.now() - new Date(dateString)) / 1000);
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [name, size] of units) {
    const value = Math.floor(seconds / size);
    if (value >= 1) return `${value} ${name}${value > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

// ---------- fetching (one shared error handler for all 3 calls) ----------

async function fetchJson(path, notFoundMessage) {
  let response;

  try {
    response = await fetch(`${API}${path}`);
  } catch (err) {
    // fetch only throws when the network itself fails (offline, DNS, etc.)
    throw new Error(
      "Could not reach GitHub. Check your connection and try again.",
    );
  }

  if (response.status === 404) {
    throw new Error(notFoundMessage);
  }

  // A 403 can mean other things, so also check the quota is really used up
  const rateLimited =
    (response.status === 403 || response.status === 429) &&
    response.headers.get("x-ratelimit-remaining") === "0";

  if (rateLimited) {
    const resetSeconds = Number(response.headers.get("x-ratelimit-reset"));
    const resetTime = new Date(resetSeconds * 1000).toLocaleTimeString(); // seconds -> ms
    throw new Error(`GitHub rate limit reached. Try again after ${resetTime}.`);
  }

  if (!response.ok) {
    throw new Error(`Something went wrong (status ${response.status}).`);
  }

  return await response.json();
}

function fetchUser(username) {
  return fetchJson(
    `/users/${encodeURIComponent(username)}`,
    `No GitHub user named "${username}".`,
  );
}

// sort=pushed so the 100 repos we get are the most recently worked on
function fetchRepos(username) {
  return fetchJson(
    `/users/${encodeURIComponent(username)}/repos?per_page=100&sort=pushed`,
    "Could not find repos for this user.",
  );
}

function fetchEvents(username) {
  return fetchJson(
    `/users/${encodeURIComponent(username)}/events/public?per_page=30`,
    "Could not find activity for this user.",
  );
}

// ---------- core logic ----------

// Top 5 repos: most stars first; if stars are equal, most recently pushed first.
function getTopRepos(repos) {
  return [...repos] // copy, because .sort() changes the array it is called on
    .sort((a, b) => {
      if (a.stargazers_count !== b.stargazers_count) {
        return b.stargazers_count - a.stargazers_count; // more stars first
      }
      return new Date(b.pushed_at) - new Date(a.pushed_at); // newer push first
    })
    .slice(0, 5);
}

// Count each repo's primary language (skipping null) and turn it into percentages.
// "exact" is used for the bar width, "percent" (rounded) is only for the label.
function getLanguageBreakdown(repos) {
  const counts = {};

  for (const repo of repos) {
    if (!repo.language) continue; // skip null languages
    counts[repo.language] = (counts[repo.language] || 0) + 1;
  }

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (total === 0) return []; // avoids dividing by zero

  return Object.entries(counts)
    .map(([name, count]) => ({
      name,
      exact: (count / total) * 100,
      percent: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.exact - a.exact)
    .slice(0, 6); // show the 6 biggest; the grey end of the bar is "other"
}

// Turn one raw event into a readable sentence, or null to skip it.
function describeEvent(event) {
  switch (event.type) {
    case "PushEvent": {
      const repoName = event.repo.name;
      // GitHub may not include the commit list, so fall back gracefully
      const count = event.payload.commits
        ? event.payload.commits.length
        : event.payload.size;
      if (!count) return `Pushed to ${repoName}`;
      return `Pushed ${count} commit${count > 1 ? "s" : ""} to ${repoName}`;
    }
    case "CreateEvent":
      if (event.payload.ref_type !== "repository") return null; // skip branches and tags
      return `Created repository ${event.repo.name}`;
    case "ForkEvent":
      return `Forked ${event.repo.name}`;
    default:
      return null; // ignore every other event type
  }
}

// ---------- rendering (textContent only, never innerHTML) ----------

function renderProfile(user) {
  profileEl.textContent = ""; // clear any previous card

  const avatar = document.createElement("img");
  avatar.className = "avatar";
  avatar.src = user.avatar_url;
  avatar.alt = `${user.login}'s avatar`;

  const info = document.createElement("div");

  const name = document.createElement("h2");
  name.textContent = user.name || user.login;

  const handle = document.createElement("a");
  handle.className = "handle";
  handle.href = user.html_url;
  handle.textContent = `@${user.login}`;
  handle.target = "_blank";
  handle.rel = "noopener";

  const bio = document.createElement("p");
  bio.className = "bio";
  bio.textContent = user.bio || "No bio available.";

  const stats = document.createElement("p");
  stats.className = "stats";
  stats.textContent = `${user.followers.toLocaleString()} followers · ${user.public_repos} public repos`;

  info.append(name, handle, bio, stats);
  profileEl.append(avatar, info);
}

function renderRepos(repos) {
  reposEl.textContent = "";

  if (repos.length === 0) {
    reposEl.textContent = "No original repos to show.";
    return;
  }

  for (const repo of repos) {
    const item = document.createElement("div");
    item.className = "repo";

    const link = document.createElement("a");
    link.href = repo.html_url;
    link.textContent = repo.name;
    link.target = "_blank";
    link.rel = "noopener";

    const desc = document.createElement("p");
    desc.textContent = repo.description || "No description.";

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = `★ ${repo.stargazers_count.toLocaleString()} · ${repo.language || "No language"}`;

    item.append(link, desc, meta);
    reposEl.append(item);
  }
}

const LANG_COLORS = [
  "#0f766e",
  "#2563eb",
  "#d97706",
  "#9333ea",
  "#dc2626",
  "#64748b",
];

function renderLanguages(languages) {
  languagesEl.textContent = "";

  if (languages.length === 0) {
    languagesEl.textContent = "No language data.";
    return;
  }

  const bar = document.createElement("div");
  bar.className = "lang-bar";
  const legend = document.createElement("ul");
  legend.className = "lang-legend";

  languages.forEach((lang, i) => {
    const color = LANG_COLORS[i % LANG_COLORS.length];

    const segment = document.createElement("span");
    segment.style.width = `${lang.exact}%`; // exact value, so the bar fills fully
    segment.style.background = color;
    segment.title = `${lang.name} ${lang.percent}%`;
    bar.append(segment);

    const li = document.createElement("li");
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = color;
    li.append(dot, `${lang.name} ${lang.percent}%`);
    legend.append(li);
  });

  languagesEl.append(bar, legend);
}

function renderActivity(events) {
  activityEl.textContent = "";

  // Turn events into sentences, merging identical consecutive ones ("... (3 times)")
  const items = [];
  for (const event of events) {
    const text = describeEvent(event);
    if (!text) continue;
    const last = items[items.length - 1];
    if (last && last.text === text) {
      last.count++;
      continue;
    }
    items.push({ text, when: event.created_at, count: 1 });
  }

  if (items.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No recent public activity.";
    activityEl.append(li);
    return;
  }

  for (const item of items.slice(0, 8)) {
    const li = document.createElement("li");
    const label =
      item.count > 1 ? `${item.text} (${item.count} times)` : item.text;
    li.append(label + " ");

    const when = document.createElement("span");
    when.className = "when";
    when.textContent = timeAgo(item.when);
    li.append(when);

    activityEl.append(li);
  }
}

// ---------- wiring ----------

form.addEventListener("submit", async (event) => {
  event.preventDefault(); // stop the page from reloading
  const username = input.value.trim();

  if (!username) {
    setStatus("Enter a GitHub username.", true);
    return;
  }

  setStatus("Loading…");
  button.disabled = true;
  card.hidden = true;

  try {
    const user = await fetchUser(username); // fails fast on a wrong username
    const [repos, events] = await Promise.all([
      fetchRepos(username),
      fetchEvents(username),
    ]);

    // Showcase the person's own work: forks are left out of repos and languages
    const ownRepos = repos.filter((repo) => !repo.fork);

    renderProfile(user);
    renderRepos(getTopRepos(ownRepos));
    renderLanguages(getLanguageBreakdown(ownRepos));
    renderActivity(events);

    card.hidden = false;
    setStatus("");
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    button.disabled = false; // runs on success and on failure
  }
});

// ---------- theme toggle ----------

const themeToggle = document.getElementById("theme-toggle");
const root = document.documentElement;

// The button names the theme you will switch TO
function updateToggleLabel() {
  themeToggle.textContent =
    root.dataset.theme === "dark" ? "Light mode" : "Dark mode";
}

themeToggle.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try {
    localStorage.setItem("theme", next); // remember the choice
  } catch (e) {} // storage can be blocked; the toggle still works for this visit
  updateToggleLabel();
});

updateToggleLabel(); // set the right label on page load