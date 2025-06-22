from fastapi import APIRouter, Query, HTTPException, UploadFile, File, BackgroundTasks
from app.services.analyze_trivy import (
    run_trivy_scan, 
    analyze_with_ai, 
    run_trivy_scan_file, 
    background_ai_analysis,
    get_ai_analysis
)
from app.services.trivy_parser import simplify_trivy_data
import os

router = APIRouter()

@router.get("/trivy")
#http://localhost:8000/api/trivy?image=alpine:latest
def scan_docker_image(image: str = Query(..., description="Docker imaj adı")):
    """
    Trivy ile Docker imajını tarar.
    """
    try:
        scan_result = run_trivy_scan(image)
        simplified_result = simplify_trivy_data(scan_result)
        return {"scan_result": simplified_result}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/trivy/file")
def scan_file(file: UploadFile = File(...)):
    """
    Trivy ile dosya taraması yapar.
    """
    try:
        scan_result = run_trivy_scan_file(file)
        simplified_result = simplify_trivy_data(scan_result)
        return {"scan_result": simplified_result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/trivy/analyze")
#http://localhost:8000/api/trivy/analyze?image=alpine:latest
async def analyze_docker_image(
    background_tasks: BackgroundTasks,
    image: str = Query(..., description="Docker imaj adı")
):
    """
    Trivy taramasını yapar ve AI ile analiz eder.
    """
    try:
        scan_result = run_trivy_scan(image)
        analysis_id = f"trivy_{os.urandom(8).hex()}"
        
        # Start AI analysis in background
        background_tasks.add_task(background_ai_analysis, analysis_id, scan_result)
        
        return {
            "status": "success",
            "image": image,
            "scan_result": scan_result,
            "analysis_id": analysis_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/trivy/analyze/file")
async def analyze_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """
    Dosya taramasını yapar ve AI ile analiz eder.
    """
    try:
        scan_result = run_trivy_scan_file(file)
        analysis_id = f"trivy_{os.urandom(8).hex()}"
        
        # Start AI analysis in background
        background_tasks.add_task(background_ai_analysis, analysis_id, scan_result)
        
        return {
            "status": "success",
            "filename": file.filename,
            "scan_result": scan_result,
            "analysis_id": analysis_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/trivy/ai-status/{analysis_id}")
async def get_ai_status(analysis_id: str):
    """Get AI analysis status and result"""
    result = await get_ai_analysis(analysis_id)
    if result is None:
        return {"status": "pending"}
    return {"status": "completed", "ai_comment": result}
