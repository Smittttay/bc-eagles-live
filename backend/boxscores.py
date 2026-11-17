"""Read-only parser for official BC Athletics women's lacrosse box scores."""

from urllib.parse import urlparse
from bs4 import BeautifulSoup
import httpx


def validate_url(url):
    parsed = urlparse(url)
    if (
        parsed.scheme != "https"
        or parsed.hostname not in ("bceagles.com", "www.bceagles.com")
        or not parsed.path.startswith("/sports/womens-lacrosse/stats/")
        or "/boxscore/" not in parsed.path
        or not parsed.path.rstrip("/").split("/")[-1].isdigit()
        or parsed.username is not None
        or parsed.password is not None
        or parsed.port is not None
    ):
        raise ValueError("Not an official women's lacrosse box-score URL")
    return url


def cells(row):
    return [
        cell.get_text(" ", strip=True)
        for cell in row.find_all(["th", "td"], recursive=False)
    ]


def table_rows(table):
    return [cells(row) for row in table.find_all("tr")]


def team_heading(table, team_names):
    """Find the nearest enclosing heading identifying a team."""
    for parent in table.parents:
        if parent.name not in ("div", "section", "article"):
            continue

        headings = parent.find_all(
            ["h2", "h3", "h4", "h5", "h6"],
            limit=5
        )
        names = [
            heading.get_text(" ", strip=True)
            for heading in headings
        ]
        for name in names:
            if name in team_names:
                return name

    return None


def parse_boxscore(html):
    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table")

    if len(tables) < 8:
        raise ValueError("Expected statistics tables not found")

    scoring = table_rows(tables[0])
    if not scoring or scoring[0][0] != "Team":
        raise ValueError("Scoring table not recognized")

    teams = {}
    for row in scoring[1:]:
        if len(row) >= 6:
            teams[row[0]] = {
                "periods": row[1:-1],
                "total": row[-1]
            }

    if "Boston College" not in teams or len(teams) != 2:
        raise ValueError("Could not identify both teams")

    opponent = next(
        name for name in teams if name != "Boston College"
    )

    players = {}
    for table in tables:
        rows = table_rows(table)
        if not rows:
            continue

        header = rows[0]
        if (
            "Player" not in header
            or "G" not in header
            or "A" not in header
            or "SOG" not in header
        ):
            continue

        team = team_heading(table, set(teams))
        if team not in teams:
            raise ValueError("Player table has no verified team heading")
        if team in players:
            raise ValueError("Duplicate player table for " + team)

        entries = []
        for row in rows[1:]:
            if len(row) < len(header):
                continue

            record = dict(zip(header, row))
            name = record.get("Player", "").strip()

            if not name or name.lower() in ("totals", "team"):
                continue

            entries.append(record)

        players[team] = entries

    if set(players) != set(teams):
        raise ValueError("Missing player statistics for a team")

    # Find the team statistics table by its section labels.
    team_stats = {}
    for table in tables:
        rows = table_rows(table)
        labels = {
            row[0] for row in rows
            if len(row) == 1
        }

        if not {"Shots", "Ground Balls", "Draw Controls"}.issubset(labels):
            continue

        category = None
        for row in rows[1:]:
            if len(row) == 1:
                category = row[0]
            elif category and row[0] in teams:
                team_stats.setdefault(category, {})[row[0]] = {
                    "periods": row[1:-1],
                    "total": row[-1]
                }
        break

    if not team_stats:
        raise ValueError("Team statistics table not recognized")

    return {
        "sport": "womens-lacrosse",
        "bc": "Boston College",
        "opponent": opponent,
        "scoring": teams,
        "players": players,
        "team_stats": team_stats,
    }


def fetch_boxscore(url):
    validate_url(url)

    with httpx.Client(
        timeout=30,
        follow_redirects=False,
        headers={"User-Agent": "Mozilla/5.0"}
    ) as client:
        response = client.get(url)
        response.raise_for_status()
        return parse_boxscore(response.text)


if __name__ == "__main__":
    url = (
        "https://bceagles.com/sports/womens-lacrosse/"
        "stats/2026/northwestern/boxscore/26365"
    )

    data = fetch_boxscore(url)

    print("===== NATIVE BOX SCORE TEST =====")
    print("BC:", data["scoring"]["Boston College"])
    print("OPPONENT:", data["opponent"])
    print("OPPONENT SCORE:", data["scoring"][data["opponent"]])
    print()

    for team, roster in data["players"].items():
        print(team, "PLAYER RECORDS:", len(roster))
        for player in roster[:3]:
            print(
                " ", player.get("Player"),
                "G:", player.get("G"),
                "A:", player.get("A"),
                "P:", player.get("P")
            )

    print()
    for category in ("Shots", "Saves", "Ground Balls", "Draw Controls"):
        values = data["team_stats"].get(category, {})
        print(
            category,
            "BC:", values.get("Boston College", {}).get("total"),
            "Opponent:", values.get(data["opponent"], {}).get("total")
        )

    print("\n===== PARSER TEST COMPLETE =====")
