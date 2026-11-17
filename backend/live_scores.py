import httpx
from datetime import datetime, timezone

SIDEARM_HOCKEY_URL = (
    "https://sidearmstats.com/bc/mhockey/game.json"
)


def normalize_sidearm(data):
    game = data.get("Game") or {}

    home = game.get("HomeTeam") or {}
    away = game.get("VisitingTeam") or {}

    started = game.get("HasStarted") is True
    complete = game.get("IsComplete") is True

    if complete:
        status = "final"
    elif started:
        status = "live"
    else:
        status = "scheduled"

    seconds = game.get("ClockSeconds")
    clock = None

    if isinstance(seconds, (int, float)) and seconds >= 0:
        minutes = int(seconds) // 60
        remainder = int(seconds) % 60
        clock = f"{minutes}:{remainder:02d}"

    return {
        "source": "SIDEARM",
        "sport": "mens-ice-hockey",
        "status": status,
        "date": game.get("Date"),
        "home_team": home.get("Name"),
        "away_team": away.get("Name"),
        "home_score": home.get("Score"),
        "away_score": away.get("Score"),
        "period": game.get("Period") if started else None,
        "clock": clock if started else None,
        "period_scores": {
            "home": home.get("PeriodScores", []),
            "away": away.get("PeriodScores", []),
        },
        "stats": data.get("Stats") or {},
        "leaders": data.get("Leaders") or {},
        "plays": data.get("Plays") or [],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


async def fetch_hockey_score():
    async with httpx.AsyncClient(
        timeout=15,
        follow_redirects=True
    ) as client:
        response = await client.get(
            SIDEARM_HOCKEY_URL,
            params={"detail": "full"}
        )
        response.raise_for_status()
        return normalize_sidearm(response.json())
