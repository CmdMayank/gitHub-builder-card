# GitHub Builder Card

Enter a GitHub username and get a one-page profile card: the person's top repos, main languages and recent activity.

**Live demo:** _add your Netlify/Vercel link here after deploying_

## How it works

Plain HTML, CSS and vanilla JavaScript. There is no backend and no build step: the browser calls the public GitHub REST API directly.

| Section | API endpoint |
|---|---|
| Profile header | `GET /users/{username}` |
| Top repos and languages | `GET /users/{username}/repos` |
| Recent activity | `GET /users/{username}/events/public` |

Run it locally by opening `index.html` in a browser (or with a tool like VS Code Live Server).

## Design decisions

**Top repos.** Repos are ranked by stars, highest first. If two repos have the same number of stars, the one pushed most recently wins. I picked stars because it is a simple signal of how much other people value a project, and the `pushed_at` tiebreaker favours work that is still alive. It needs no extra API calls. Only the 5 top repos are shown.

**Forks are excluded.** The card is meant to show what the person built, and a forked project mostly carries someone else's work and history. Forks are left out of both the top repos and the language breakdown.

**Main languages.** Each repo's primary `language` field is counted (repos with no language are skipped) and turned into percentages. This counts repos, not lines of code. It is a cheap and honest approximation, and the exact per-repo byte counts would need one extra API request per repo, which the rate limit does not allow. The bar shows the 6 biggest languages, and any grey at the end of the bar is "other".

**Recent activity.** Only three kinds of events are shown: pushes, new repositories (not new branches or tags) and forks, each turned into a readable sentence with a relative time. Identical consecutive events are merged, for example "Pushed to owner/repo (3 times)".

## Edge cases handled

- Empty input
- Username not found (404)
- GitHub rate limit reached (shows the time it resets)
- Network failure (offline or unreachable)
- User with no original repos, no language data, or no recent activity
- Missing name or bio
- Long bios and descriptions wrap instead of breaking the layout
- All API text is inserted with `textContent`, never `innerHTML`, so profile data cannot inject HTML

## Known limitations

- Unauthenticated GitHub API requests are limited to 60 per hour per IP address. One card uses 3 requests.
- Only the 100 most recently pushed repos are fetched, so a user with more than 100 repos may have an older repo missing from the ranking.
- GitHub's public events cover roughly the last 30 days and may not include commit counts, so some users show little or no activity.

## What I would add next

- A small serverless function holding a GitHub token, for much higher rate limits and caching of responses
- Real commit counts per repo
- A shareable link such as `?user=torvalds`

## AI usage

I used AI assistance (Claude) while building this. It helped with planning, the HTML skeleton and CSS, and writing and debugging much of the JavaScript. I ran and tested the app myself and can walk through every part of the code.