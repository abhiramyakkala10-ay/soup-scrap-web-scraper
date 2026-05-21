from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import os

from scraper import scrape_url

app = FastAPI(title="Soup Scraper API", version="1.0.0")

# Enable CORS for local testing/development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScrapeRequest(BaseModel):
    url: str = Field(..., description="The target website URL to scrape")
    target: str = Field("all", description="Type of components to scrape (e.g. all, links, images, tables)")
    selector: Optional[str] = Field(None, description="Custom CSS selector to extract")
    user_agent: str = Field("chrome", description="The User-Agent profile to fetch the page with")

@app.post("/api/scrape")
def run_scrape(request: ScrapeRequest):
    if not request.url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")
        
    result = scrape_url(
        url=request.url,
        target=request.target,
        selector=request.selector,
        user_agent_type=request.user_agent
    )
    
    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])
        
    return result

# Create the static files directory if it does not exist
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)
os.makedirs(os.path.join(static_dir, "css"), exist_ok=True)
os.makedirs(os.path.join(static_dir, "js"), exist_ok=True)

# Mount the static files
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
