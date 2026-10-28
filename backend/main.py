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
