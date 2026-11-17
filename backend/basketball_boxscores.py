"""Official Boston College men's and women's basketball box scores."""

import re
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse


BC = "Boston College"

URL_PATTERN = re.compile(
    r"^/sports/(mens|womens)-basketball/stats/"
    r"[^?#]+/boxscore/\d+/?$",
    re.I,
)


def validate_basketball_url(url):
    """Allow only official BC basketball box-score URLs."""
    try:
        parsed = urlparse(url)
        return (
            parsed.scheme == "https"
            and parsed.hostname == "bceagles.com"
            and parsed.port is None
            and not parsed.username
            and not parsed.password
            and not parsed.query
            and not parsed.fragment
            and bool(URL_PATTERN.fullmatch(parsed.path))
        )
    except (ValueError, TypeError):
        return False


def cells(row):
    return [
        cell.get_text(" ", strip=True)
        for cell in row.find_all(["th", "td"], recursive=False)
    ]


def rows(table):
    return [
        values
        for row in table.find_all("tr")
        if (values := cells(row))
    ]


def parse_basketball_boxscore(html, sport=None):
    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table")

    scoreboard = next(
        (
            table for table in tables
            if table.get("aria-label") == "Game scoreboard"
        ),
        None,
    )

    if scoreboard is None:
        raise ValueError("Basketball scoreboard not found")

    score_rows = rows(scoreboard)

    if len(score_rows) < 3:
        raise ValueError("Incomplete basketball scoreboard")

    header = score_rows[0]
    scoring = {}

    for values in score_rows[1:]:
        if len(values) == len(header):
            scoring[values[0]] = {
                "periods": values[1:-1],
                "total": values[-1],
            }

    if BC not in scoring or len(scoring) != 2:
        raise ValueError("Cannot identify basketball teams")

    opponent = next(name for name in scoring if name != BC)

    if sport is None:
        sport = (
            "womens-basketball"
            if len(scoring[BC]["periods"]) == 4
            else "mens-basketball"
        )

    players = {}
    shooting = {}

    for table in tables:
        label = table.get("aria-label", "")
        data = rows(table)

        if label.endswith(" Player Statistics"):
            team = label.removesuffix(" Player Statistics")
            if data:
                players[team] = {
                    "headers": data[0],
                    "rows": [
                        values for values in data[1:]
                        if len(values) == len(data[0])
                    ],
                }

        elif label.endswith(" Team Summary"):
            team = label.removesuffix(" Team Summary")
            if data:
                shooting[team] = {
                    "headers": data[0],
                    "rows": data[1:],
                }

    if BC not in players or opponent not in players:
        raise ValueError("Basketball player tables missing")

    if BC not in shooting or opponent not in shooting:
        raise ValueError("Basketball shooting summaries missing")

    extra = []

    for table in tables:
        if not table.get("aria-label"):
            extra = rows(table)
            if extra:
                break

    return {
        "sport": sport,
        "bc": BC,
        "opponent": opponent,
        "scoring": scoring,
        "period_labels": header[1:-1],
        "players": players,
        "shooting": shooting,
        "team_stats": extra,
    }


def fetch_basketball_boxscore(url):
    if not validate_basketball_url(url):
        raise ValueError("Invalid BC basketball box-score URL")

    response = requests.get(
        url,
        timeout=25,
        headers={"User-Agent": "Mozilla/5.0"},
    )
    response.raise_for_status()

    sport = (
        "womens-basketball"
        if "/womens-basketball/" in url
        else "mens-basketball"
    )

    return parse_basketball_boxscore(response.text, sport)
