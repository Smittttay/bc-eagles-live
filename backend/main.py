from backend.soccer_live import fetch_soccer_live
from backend.live_scores import fetch_hockey_score
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from backend.schedule import fetch_schedule, SPORTS, SOURCE

ROOT = Path(__file__).resolve().parent.parent
app = FastAPI(title="BC Eagles Live", version="0.1.0")
app.mount("/static", StaticFiles(directory=ROOT / "frontend"), name="static")

@app.get("/")
def home():
    return FileResponse(ROOT / "frontend" / "index.html")

@app.get("/api/sports")
def sports():
    return [{"id": key, "name": value} for key, value in SPORTS.items()]

@app.get("/api/games")
async def games():
    try:
        schedule = await fetch_schedule()
        return await merge_basketball_finals(schedule)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Official BC schedule could not be retrieved."
        ) from exc

from backend.basketball_live import fetch_basketball_live

async def merge_basketball_finals(schedule):
    """Merge verified SIDEARM final scores into matching schedule games."""
    import asyncio
    import re
    from datetime import datetime
    from zoneinfo import ZoneInfo

    eastern = ZoneInfo("America/New_York")

    def normalize_name(name):
        name = str(name or "").lower()
        name = re.sub(r"\\b(college|university)\\b", "", name)
        return re.sub(r"[^a-z0-9]", "", name)

    async def get_final(sport):
        try:
            data = await fetch_basketball_live(sport)
            return data if data.get("status") == "final" else None
        except Exception:
            return None

    finals = await asyncio.gather(
        get_final("mens-basketball"),
        get_final("womens-basketball"),
    )

    for final in finals:
        if not final:
            continue

        home = str(final.get("home_team") or "")
        away = str(final.get("away_team") or "")

        bc_home = "boston college" in home.lower()
        bc_away = "boston college" in away.lower()

        if bc_home == bc_away:
            continue

        opponent = away if bc_home else home
        opponent_key = normalize_name(opponent)

        try:
            game_date = datetime.strptime(
                str(final.get("date")), "%m/%d/%Y"
            ).date()
            bc_score = int(
                final["home_score"] if bc_home else final["away_score"]
            )
            opponent_score = int(
                final["away_score"] if bc_home else final["home_score"]
            )
        except (ValueError, TypeError, KeyError):
            continue

        outcome = (
            "W" if bc_score > opponent_score
            else "L" if bc_score < opponent_score
            else "T"
        )

        matches = []
        for game in schedule.get("games", []):
            if game.get("sport_id") != final.get("sport"):
                continue

            try:
                start = datetime.fromisoformat(game["start"])
                date = start.astimezone(eastern).date()
            except (ValueError, TypeError, KeyError):
                continue

            if date != game_date:
                continue

            if normalize_name(game.get("opponent")) != opponent_key:
                continue

            matches.append(game)

        # Do not overwrite anything if matching is ambiguous.
        if len(matches) != 1:
            continue

        game = matches[0]

        # Preserve a completed official schedule result.
        if game.get("status") == "final":
            continue

        game["status"] = "final"
        game["result"] = f"{outcome} {bc_score}-{opponent_score}"
        game["live_game_id"] = final.get("game_id")
        game["result_source"] = "SIDEARM"

    return schedule


@app.get("/api/live/basketball/{sport}")
async def live_basketball(sport: str):
    if sport not in ("mens-basketball", "womens-basketball"):
        raise HTTPException(status_code=404, detail="Unknown basketball sport")
    try:
        return await fetch_basketball_live(sport)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="BC basketball live data unavailable"
        ) from exc


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "BC Eagles Live"}


@app.get("/api/live/hockey")
async def live_hockey():
    try:
        return await fetch_hockey_score()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="BC hockey live data unavailable"
        ) from exc


@app.get("/api/live/soccer")
async def live_soccer():
    try:
        return await fetch_soccer_live()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="NCAA soccer scoreboard unavailable"
        ) from exc


# STEP 119 — Official Boston College sport rosters
from backend.rosters import fetch_roster, SPORT_IDS

@app.get("/api/rosters/{sport_id}")
def sport_roster(sport_id: str):
    if sport_id not in SPORT_IDS:
        raise HTTPException(status_code=404, detail="Unknown sport")
    try:
        return fetch_roster(sport_id)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Official BC roster unavailable: {exc}"
        ) from exc


# STEP 220 — Native women's lacrosse box scores
import asyncio
import re
import time
from starlette.concurrency import run_in_threadpool
from backend.boxscores import fetch_boxscore, validate_url
from backend.football_boxscores import fetch_football_boxscore, validate_football_url
from backend.basketball_boxscores import fetch_basketball_boxscore, validate_basketball_url

_boxscore_cache = {}
_boxscore_schedule_cache = {"expires": 0, "games": []}
_boxscore_schedule_lock = asyncio.Lock()


async def _official_boxscore_url(boxscore_id: str):
    """Resolve an ID using official URLs from the BC schedule."""
    async with _boxscore_schedule_lock:
        now = time.monotonic()

        if now >= _boxscore_schedule_cache["expires"]:
            payload = await fetch_schedule()
            _boxscore_schedule_cache["games"] = payload["games"]
            _boxscore_schedule_cache["expires"] = now + 600

        for game in _boxscore_schedule_cache["games"]:
            url = game.get("box_score_url") or ""
            if not url:
                continue

            try:
                if game.get("sport_id") == "football":
                    validate_football_url(url)
                elif game.get("sport_id") == "womens-lacrosse":
                    validate_url(url)
                elif game.get("sport_id") in (
                    "mens-basketball", "womens-basketball"
                ):
                    if not validate_basketball_url(url):
                        continue
                else:
                    continue
            except (ValueError, TypeError):
                continue

            if url.rstrip("/").endswith("/boxscore/" + boxscore_id):
                return url

    return None


@app.get("/api/boxscore/{boxscore_id}")
async def native_boxscore(boxscore_id: str):
    if not re.fullmatch(r"[0-9]{1,12}", boxscore_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid box score ID"
        )

    cached = _boxscore_cache.get(boxscore_id)
    if cached and time.monotonic() < cached["expires"]:
        return cached["data"]

    try:
        url = await _official_boxscore_url(boxscore_id)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Official BC schedule temporarily unavailable"
        ) from exc

    if not url:
        raise HTTPException(
            status_code=404,
            detail="Supported native box score not found"
        )

    try:
        if "/sports/football/stats/" in url:
            data = await run_in_threadpool(
                fetch_football_boxscore, url
            )
        elif (
            "/sports/mens-basketball/stats/" in url
            or "/sports/womens-basketball/stats/" in url
        ):
            data = await run_in_threadpool(
                fetch_basketball_boxscore, url
            )
        else:
            data = await run_in_threadpool(
                fetch_boxscore, url
            )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Official box score temporarily unavailable"
        ) from exc

    data["official_url"] = url
    data["boxscore_id"] = boxscore_id

    _boxscore_cache[boxscore_id] = {
        "data": data,
        "expires": time.monotonic() + 3600
    }

    return data
