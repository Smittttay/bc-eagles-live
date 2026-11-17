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
        return await fetch_schedule()
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Official BC schedule could not be retrieved."
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
