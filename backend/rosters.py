import re
from functools import lru_cache
from datetime import datetime, timezone
import httpx
from bs4 import BeautifulSoup

SPORT_IDS = {
    "football",
    "womens-lacrosse",
    "mens-ice-hockey",
    "womens-ice-hockey",
    "mens-soccer",
    "womens-soccer",
    "field-hockey",
    "mens-basketball",
    "womens-basketball",
}

def clean(value):
    return " ".join(str(value or "").split())

def parse_roster(html):
    soup = BeautifulSoup(html, "html.parser")
    players = []
    seen = set()

    # SIDEARM Athletics roster player cards.
    selectors = [
        ".sidearm-roster-player",
        ".s-person-card",
        "[class*='roster-player']",
        "[class*='roster__player']",
    ]

    cards = []
    for selector in selectors:
        found = soup.select(selector)
        if found:
            cards = found
            break

    def field(card, selectors):
        for selector in selectors:
            node = card.select_one(selector)
            if node:
                # Exclude hidden screen-reader labels supplied by
                # the official BC Athletics roster HTML.
                from bs4 import BeautifulSoup
                copy = BeautifulSoup(str(node), "html.parser")
                for hidden in copy.select(".sr-only"):
                    hidden.decompose()
                result = clean(copy.get_text(" ", strip=True))
                if result:
                    return result
        return ""

    for card in cards:
        name = field(card, [
            ".sidearm-roster-player-name",
            ".s-person-card__name",
            "[class*='player-name']",
            "[class*='person-card__name']",
            "h3 a", "h3", "h2 a",
        ])

        number = field(card, [
            ".s-stamp__text",
            "[data-test-id='s-stamp__root'] .s-stamp__text",
            ".sidearm-roster-player-jersey-number",
            ".s-person-card__number",
            "[class*='jersey-number']",
            "[class*='player-number']",
        ])

        position = field(card, [
            "[data-test-id='s-person-details__bio-stats-person-position-short']",
            ".sidearm-roster-player-position",
            ".s-person-card__position",
            "[class*='player-position']",
        ])

        year = field(card, [
            "[data-test-id='s-person-details__bio-stats-person-title']",
            ".sidearm-roster-player-academic-year",
            ".sidearm-roster-player-class",
            ".s-person-card__academic-year",
            "[class*='academic-year']",
        ])

        # BC includes hidden accessibility labels in some fields.
        # Remove those labels while retaining the actual values.
        number = re.sub(r"^Jersey Number\\s*", "", number, flags=re.I)
        position = re.sub(r"^Position\\s*", "", position, flags=re.I)
        year = re.sub(r"^Academic Year\\s*", "", year, flags=re.I)

        name = re.sub(r"^\s*#?\d{1,3}\s+", "", name).strip()
        if not name or len(name) > 90:
            continue

        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)

        players.append({
            "number": number.lstrip("#").strip() or "—",
            "name": name,
            "position": position or "—",
            "year": year or "—",
        })

    return players

@lru_cache(maxsize=32)
def _cached_roster(sport, hour_bucket):
    url = f"https://bceagles.com/sports/{sport}/roster"
    with httpx.Client(
        follow_redirects=True,
        timeout=20,
        headers={"User-Agent": "Mozilla/5.0 BC-Eagles-Live/1.0"},
    ) as client:
        response = client.get(url)
        response.raise_for_status()

    players = parse_roster(response.text)
    if not players:
        raise ValueError(
            "The official roster page was retrieved, but player "
            "details could not be verified."
        )

    return {
        "sport_id": sport,
        "source": "Boston College Athletics",
        "source_url": str(response.url),
        "players": players,
        "count": len(players),
    }

def fetch_roster(sport):
    if sport not in SPORT_IDS:
        raise ValueError("Unsupported sport")

    hour = int(datetime.now(timezone.utc).timestamp() // 3600)
    return _cached_roster(sport, hour)
