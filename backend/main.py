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
