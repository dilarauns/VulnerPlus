import requests
from fastapi import APIRouter, Query, HTTPException
from app.services.analyze_trivy import run_trivy_scan, analyze_with_ai 


router = APIRouter()

@router.get("/trivy/analyze")
def analyze_docker_image(
    image: str = Query(..., description="Docker imaj adı"),
    show_references: bool = Query(False, description="Referansları göster")
):
    try:
        trivy_response = requests.get(f"http://0.0.0.0:8000/api/trivy/image?image={image}")
        trivy_data = trivy_response.json()

        if "error" in trivy_data:
            raise HTTPException(status_code=400, detail=trivy_data["error"])

        # Referansları kaldır (çıktıda da görünmesin)
        if not show_references:
            for result in trivy_data.get("scan_result", {}).get("Results", []):
                for vuln in result.get("Vulnerabilities", []):
                    vuln.pop("References", None)

        ai_result = analyze_with_ai(trivy_data, show_references)

        return {
            "image": image,
            "scan_result": trivy_data["scan_result"],
            **ai_result
        }

    except Exception as e:
        return {"error": str(e)}
