import httpx
from datetime import datetime, timezone

FEEDS = {
    "mens-basketball": "https://sidearmstats.com/bc/mbball/game.json",
    "womens-basketball": "https://sidearmstats.com/bc/wbball/game.json",
}


async def fetch_basketball_live(sport):
    if sport not in FEEDS:
        raise ValueError("Unsupported basketball sport")

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        response = await client.get(
            FEEDS[sport],
            params={"detail": "full"},
        )
        response.raise_for_status()
        payload = response.json()
        game = payload.get("Game") or {}
        stats = payload.get("Stats") or {}
        raw_plays = payload.get("Plays") or []

    def team_values(side):
        team = stats.get(side) or {}
        return ((team.get("Totals") or {}).get("Values") or {})

    def player_values(side):
        team = stats.get(side) or {}
        groups = team.get("PlayerGroups") or {}
        players = groups.get("Players") or {}
        return players.get("Values") or []

    team_stats = {
        "home": team_values("HomeTeam"),
        "away": team_values("VisitingTeam"),
    }

    player_stats = {
        "home": player_values("HomeTeam"),
        "away": player_values("VisitingTeam"),
    }

    plays = []
    for play in raw_plays[-150:]:
        if not isinstance(play, dict):
            continue

        player = play.get("Player") or {}
        seconds = play.get("ClockSeconds")
        play_clock = None

        if isinstance(seconds, (int, float)) and seconds >= 0:
            play_clock = f"{int(seconds) // 60}:{int(seconds) % 60:02d}"

        plays.append({
            "id": play.get("Id"),
            "team": play.get("Team"),
            "period": play.get("Period"),
            "clock": play_clock,
            "description": play.get("Narrative"),
            "type": play.get("Type"),
            "action": play.get("Action"),
            "player": (
                (str(player.get("FirstName") or "") + " " +
                 str(player.get("LastName") or "")).strip()
            ),
        })

    if game.get("IsComplete") is True:
        status = "final"
    elif game.get("HasStarted") is True:
        status = "live"
    else:
        status = "scheduled"

    home = game.get("HomeTeam") or {}
    away = game.get("VisitingTeam") or {}

    seconds = game.get("ClockSeconds")
    clock = None
    if isinstance(seconds, (int, float)) and seconds >= 0:
        clock = f"{int(seconds) // 60}:{int(seconds) % 60:02d}"

    return {
        "source": "SIDEARM",
        "sport": sport,
        "status": status,
        "date": game.get("Date"),
        "game_id": game.get("SidearmGameId"),
        "home_team": home.get("Name"),
        "away_team": away.get("Name"),
        "home_score": home.get("Score"),
        "away_score": away.get("Score"),
        "period": game.get("Period"),
        "clock": clock,
        "period_scores": {
            "home": home.get("PeriodScores") or [],
            "away": away.get("PeriodScores") or [],
        },
        "team_stats": team_stats,
        "player_stats": player_stats,
        "plays": plays,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
