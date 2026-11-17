import asyncio
import re
from datetime import datetime
from zoneinfo import ZoneInfo
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

SOURCE = "https://bceagles.com"
ET = ZoneInfo("America/New_York")

SPORTS = {
    "football": "Football",
    "womens-lacrosse": "Women's Lacrosse",
    "mens-ice-hockey": "Men's Hockey",
    "womens-ice-hockey": "Women's Hockey",
    "mens-soccer": "Men's Soccer",
    "womens-soccer": "Women's Soccer",
    "field-hockey": "Women's Field Hockey",
    "mens-basketball": "Men's Basketball",
    "womens-basketball": "Women's Basketball",
}

# Fall sports use the current calendar year.
# Winter/spring sports may span two calendar years.
FALL_SPORTS = {
    "football", "mens-soccer", "womens-soccer", "field-hockey"
}

def schedule_year(sport, now):
    # STEP 138: Women's Lacrosse plays in spring.
    # If BC has not published the next spring schedule,
    # the default schedule URL still shows the completed
    # spring season. Parse those dates in the correct year.
    if sport == "womens-lacrosse":
        return now.year - 1

    if sport in FALL_SPORTS:
        return now.year
    return now.year if now.month >= 7 else now.year - 1

def parse_date(value, season, sport):
    match = re.search(
        r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
        r"\s+(\d{1,2})\b",
        value,
        re.I,
    )
    if not match:
        return None

    month = datetime.strptime(match.group(1).title(), "%b").month
    day = int(match.group(2))
    year = season

    # Hockey and basketball seasons usually cross New Year.
    if sport not in FALL_SPORTS and month <= 6:
        year = season + 1

    try:
        return datetime(year, month, day, tzinfo=ET)
    except ValueError:
        return None

def parse_time(value, date):
    if not value:
        return date

    text = value.lower().replace(".", "").strip()
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", text)
    if not match:
        return date

    hour = int(match.group(1)) % 12
    if match.group(3) == "pm":
        hour += 12

    return date.replace(
        hour=hour,
        minute=int(match.group(2) or 0),
    )


def normalized_name(value):
    return re.sub(r"[^a-z0-9]", "", value.lower())


async def discover_live_stats(client, sport, games):
    """Match official schedule-card Live Stats links by date and opponent."""
    url = f"{SOURCE}/sports/{sport}/schedule"

    try:
        response = await client.get(url)
        response.raise_for_status()
    except Exception:
        return

    soup = BeautifulSoup(response.text, "html.parser")
    cards = soup.select(".s-game-card")

    for card in cards:
        links = [
            a for a in card.find_all("a", href=True)
            if "live stat" in a.get_text(" ", strip=True).lower()
        ]
        if not links:
            continue

        text = card.get_text(" ", strip=True)
        date_match = re.search(
            r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
            r"\s+(\d{1,2})\b",
            text,
            re.I,
        )
        if not date_match:
            continue

        month = datetime.strptime(date_match.group(1).title(), "%b").month
        day = int(date_match.group(2))

        candidates = []
        for game in games:
            start = datetime.fromisoformat(game["start"])
            if start.month != month or start.day != day:
                continue

            opponent = normalized_name(game["opponent"])
            if not opponent:
                continue

            card_text = normalized_name(text)
            if opponent in card_text:
                candidates.append(game)

        if len(candidates) == 1:
            candidates[0]["live_stats_url"] = urljoin(
                url, links[0]["href"]
            )


async def discover_box_scores(client, sport, games):
    """Match official box scores by sport, date and opponent."""
    url = f"{SOURCE}/sports/{sport}/schedule"

    try:
        response = await client.get(url)
        response.raise_for_status()
    except Exception:
        return

    soup = BeautifulSoup(response.text, "html.parser")

    for card in soup.select(".s-game-card"):
        links = [
            a for a in card.find_all("a", href=True)
            if a.get_text(" ", strip=True).lower() == "box score"
            and "/boxscore/" in a["href"].lower()
        ]

        if len(links) != 1:
            continue

        text = card.get_text(" ", strip=True)

        date_match = re.search(
            r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)"
            r"\s+(\d{1,2})\b",
            text,
            re.I,
        )

        if not date_match:
            continue

        month = datetime.strptime(
            date_match.group(1).title(), "%b"
        ).month
        day = int(date_match.group(2))

        candidates = []

        for game in games:
            if game.get("status") != "final":
                continue

            start = datetime.fromisoformat(game["start"])

            if (start.month, start.day) != (month, day):
                continue

            opponent = normalized_name(game["opponent"])

            if opponent and opponent in normalized_name(text):
                candidates.append(game)

        if len(candidates) == 1:
            candidates[0]["box_score_url"] = urljoin(
                url, links[0]["href"]
            )

async def fetch_sport(client, sport, now):
    season = schedule_year(sport, now)
    url = f"{SOURCE}/sports/{sport}/schedule/text"
    response = await client.get(url)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    table = soup.find("table")
    if table is None:
        raise ValueError(f"No schedule table for {sport}")

    rows = table.find_all("tr")
    games = []

    for row in rows:
        cells = [
            cell.get_text(" ", strip=True)
            for cell in row.find_all(["td", "th"], recursive=False)
        ]
        if len(cells) < 7 or cells[0].lower() == "date":
            continue

        date_text, time_text, site, opponent, location, tournament, result = cells[:7]
        game_date = parse_date(date_text, season, sport)
        if not game_date:
            continue

        start = parse_time(time_text, game_date)

        games.append({
            "id": f"{sport}-{start.date()}-{len(games)}",
            "sport": SPORTS[sport],
            "sport_id": sport,
            "opponent": opponent,
            "start": start.isoformat(),
            "home_away": site,
            "location": location,
            "result": result,
            "status": "final" if result else "scheduled",
            "url": url,
        })

    for game in games:
        game["live_stats_url"] = None
        game["box_score_url"] = None

    await discover_live_stats(client, sport, games)
    await discover_box_scores(client, sport, games)
    return games

async def fetch_schedule():
    now = datetime.now(ET)

    async with httpx.AsyncClient(
        timeout=20,
        follow_redirects=True,
        headers={"User-Agent": "Mozilla/5.0 BC-Eagles-Live/0.2"},
    ) as client:
        async def safe_fetch(sport):
            try:
                return await fetch_sport(client, sport, now), None
            except Exception as exc:
                return [], f"{sport}: {type(exc).__name__}"

        results = await asyncio.gather(
            *(safe_fetch(sport) for sport in SPORTS)
        )

    games = []
    errors = []
    for sport_games, error in results:
        games.extend(sport_games)
        if error:
            errors.append(error)

    if len(errors) == len(SPORTS):
        raise RuntimeError("All BC schedule sources failed")

    games.sort(key=lambda game: game["start"])

    return {
        "games": games,
        "errors": errors,
        "source": SOURCE,
        "verified": len(errors) == 0,
    }
