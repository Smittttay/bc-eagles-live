"""Native football box scores from official BC Athletics pages."""

import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup


CATEGORIES = {
    "passing": "Offensive Passing Statistics",
    "rushing": "Offensive Rushing Statistics",
    "receiving": "Offensive Receiving Statistics",
    "defense": "Defensive Statistics",
    "punting": "Punting Statistics",
    "field_goals": "Field Goals Statistics",
    "kickoffs": "Kickoffs Statistics",
    "returns": "All Returns Statistics",
    "extra_points": "Point After Touchdown Statistics",
}


def validate_football_url(url):
    if not isinstance(url, str):
        raise ValueError("Invalid football URL")

    parsed = urlparse(url)

    if (
        parsed.scheme != "https"
        or parsed.hostname not in (
            "bceagles.com", "www.bceagles.com"
        )
        or parsed.username is not None
        or parsed.password is not None
        or parsed.port is not None
        or parsed.query
        or parsed.fragment
        or not re.fullmatch(
            r"/sports/football/stats/[^/]+/[^/]+/"
            r"boxscore/[0-9]{1,12}/?",
            parsed.path
        )
    ):
        raise ValueError("Not an official football box-score URL")

    return url


def row_cells(row):
    return [
        cell.get_text(" ", strip=True)
        for cell in row.find_all(
            ["th", "td"], recursive=False
        )
    ]


def table_rows(table):
    return [
        row_cells(row)
        for row in table.find_all("tr")
    ]


def parse_stat_table(table):
    rows = table_rows(table)

    if not rows:
        return {"headers": [], "rows": []}

    # Some special-teams tables have grouped headers.
    # Preserve all rows rather than discarding columns.
    headers = rows[0]

    return {
        "headers": headers,
        "rows": rows[1:]
    }


def parse_football_boxscore(html):
    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table")

    scoreboard = soup.find(
        "table", attrs={"aria-label": "Game scoreboard"}
    )

    if scoreboard is None:
        raise ValueError("Football scoreboard not found")

    scoring_rows = table_rows(scoreboard)

    if (
        len(scoring_rows) != 3
        or not scoring_rows[0]
        or scoring_rows[0][0] != "Team"
    ):
        raise ValueError("Football scoreboard format not recognized")

    scoring = {}

    for row in scoring_rows[1:]:
        if len(row) < 6:
            raise ValueError("Incomplete football scoreboard")

        scoring[row[0]] = {
            "periods": row[1:-1],
            "total": row[-1]
        }

    if "Boston College" not in scoring or len(scoring) != 2:
        raise ValueError("Could not identify both football teams")

    opponent = next(
        team for team in scoring
        if team != "Boston College"
    )

    # Ensure the quarter totals agree with final scores.
    for team, values in scoring.items():
        try:
            quarter_sum = sum(
                int(value) for value in values["periods"]
            )
            final = int(values["total"])
        except ValueError as exc:
            raise ValueError(
                "Invalid scoring values for " + team
            ) from exc

        if quarter_sum != final:
            raise ValueError(
                "Quarter totals do not match final for " + team
            )

    players = {
        "Boston College": {},
        opponent: {}
    }

    for table in tables:
        label = table.get("aria-label", "")

        for category, suffix in CATEGORIES.items():
            for team in scoring:
                expected = team + " " + suffix

                if label == expected:
                    if category in players[team]:
                        raise ValueError(
                            "Duplicate " + category + " for " + team
                        )

                    players[team][category] = (
                        parse_stat_table(table)
                    )

    required = (
        "passing", "rushing", "receiving", "defense"
    )

    for team in scoring:
        for category in required:
            if category not in players[team]:
                raise ValueError(
                    "Missing " + category + " for " + team
                )

    # Scoring summary has dynamic aria-labelledby IDs.
    # Identify it by its actual column headings.
    scoring_plays = []

    for table in tables:
        rows = table_rows(table)

        if not rows:
            continue

        header = rows[0]

        if (
            "Scoring play" in header
            and "Quarter" in header
            and "Time" in header
        ):
            scoring_plays = [
                dict(zip(header, row))
                for row in rows[1:]
                if len(row) == len(header)
            ]
            break

    # Preserve the official team comparison table.
    # Its first row contains team abbreviations, while
    # category labels can occupy a single cell.
    team_stats = []

    for table in tables:
        rows = table_rows(table)

        if not rows:
            continue

        first = rows[0]

        if (
            len(first) == 3
            and first[0] == "-"
            and any(
                len(row) == 1 and row[0] == "First Downs"
                for row in rows[1:]
            )
        ):
            team_stats = rows
            break

    if not team_stats:
        raise ValueError("Football team statistics not found")

    return {
        "sport": "football",
        "bc": "Boston College",
        "opponent": opponent,
        "scoring": scoring,
        "players": players,
        "scoring_plays": scoring_plays,
        "team_stats": team_stats,
    }


def fetch_football_boxscore(url):
    validate_football_url(url)

    with httpx.Client(
        timeout=40,
        follow_redirects=False,
        headers={"User-Agent": "Mozilla/5.0"}
    ) as client:
        response = client.get(url)
        response.raise_for_status()
        return parse_football_boxscore(response.text)
