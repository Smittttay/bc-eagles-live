import json
import re
from urllib.parse import urlsplit, parse_qsl, urlencode, urlunsplit
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx
from bs4 import BeautifulSoup

PAGE = "https://www.ncaa.com/scoreboard/soccer-men/d1"


async def fetch_soccer_live():
    async with httpx.AsyncClient(
        timeout=20, follow_redirects=True
    ) as client:
        page = await client.get(PAGE)
        page.raise_for_status()
        soup = BeautifulSoup(page.text, "html.parser")

        config = None
        for script in soup.find_all("script"):
            content = script.string or script.get_text()
            match = re.search(r'"scoreboard"\s*:', content)
            if not match:
                continue
            try:
                config, _ = json.JSONDecoder().raw_decode(
                    content[match.end():].lstrip()
                )
                break
            except ValueError:
                continue

        if not config:
            raise ValueError("NCAA scoreboard configuration missing")

        today = datetime.now(ZoneInfo("America/New_York"))
        date = today.strftime("%m/%d/%Y")

        parts = urlsplit(config["contestsDataUrl"])
        params = dict(parse_qsl(parts.query))
        params["variables"] = json.dumps({
            "sportCode": "MSO",
            "division": 1,
            "seasonYear": today.year,
            "contestDate": date,
        }, separators=(",", ":"))

        url = urlunsplit((
            parts.scheme,
            parts.netloc,
            parts.path,
            urlencode(params),
            parts.fragment,
        ))

        response = await client.get(url)
        response.raise_for_status()
        payload = response.json()

        if payload.get("errors"):
            raise ValueError("NCAA scoreboard query failed")

        contests = (payload.get("data") or {}).get("contests") or []

        for contest in contests:
            if contest.get("startDate") != date:
                continue

            teams = contest.get("teams") or []
            bc = next((
                team for team in teams
                if team.get("seoname") == "boston-college"
                or team.get("nameShort") == "Boston College"
            ), None)

            if not bc:
                continue

            opponent = next(
                (team for team in teams if team is not bc),
                None
            )

            if not opponent:
                continue

            game_state = contest.get("gameState")
            status = (
                "live" if game_state == "I"
                else "final" if game_state == "F"
                else "scheduled"
            )

            return {
                "source": "NCAA",
                "sport": "mens-soccer",
                "contest_id": contest.get("contestId"),
                "date": date,
                "status": status,
                "period": contest.get("currentPeriod"),
                "clock": contest.get("contestClock"),
                "bc_score": bc.get("score"),
                "opponent": opponent.get("nameShort"),
                "opponent_score": opponent.get("score"),
                "bc_home": bool(bc.get("isHome")),
                "game_url": "https://www.ncaa.com" +
                    str(contest.get("url") or ""),
            }

        return {
            "source": "NCAA",
            "sport": "mens-soccer",
            "date": date,
            "status": "no_game",
            "message": "No BC men's soccer game found today",
        }
