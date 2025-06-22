from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.api import infer
from app.api.falco import router as falco_router
from app.api.trivy import router as trivy_router
from app.api.analyze import router as analyze_router
from app.api.pmd import router as pmd_router
from app.install_trivy import check_and_install_trivy
from app.install_pmd import check_and_install_pmd_dependencies
import os

app = FastAPI(title="Siber Güvenlik API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(falco_router, prefix="/api")
app.include_router(trivy_router, prefix="/api")
app.include_router(analyze_router, prefix="/api")
app.include_router(pmd_router, prefix="/api/pmd")
app.include_router(infer.router, prefix="/api/infer")


# Serve static files
app.mount("/assets", StaticFiles(directory="app/client/dist/assets"), name="static")

@app.get("/")
async def serve_spa(request: Request):
    return FileResponse("app/client/dist/index.html")

# TODO: Burasi sonradan profesyonel bir hale getirilecek
@app.get("/{full_path:path}")
async def serve_spa_paths(full_path: str):
    # If the path is for an API route, let it be handled by the API routers
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")
        
    # For all other routes, serve the index.html
    return FileResponse("app/client/dist/index.html")

# Health check endpoint
@app.get("/api/health")
def health_check():
    return {"status": "healthy", "message": "Falco, Trivy, PMD ve AI API Çalışıyor 🚀"}

# Initialize services
if not check_and_install_trivy():
    print("🚨 Trivy kurulamadı, API başlatılamıyor.")
    exit(1)

if not check_and_install_pmd_dependencies():
    print("🚨 PMD veya Java kurulamadı, API başlatılamıyor.")
    exit(1)
