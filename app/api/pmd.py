import subprocess
import os
import tempfile
from fastapi import APIRouter, UploadFile, File, Request, BackgroundTasks
import shutil
import json
from app.services.analyze_ai import analyze_with_ai
from fastapi.responses import JSONResponse
from typing import Optional

router = APIRouter()

# Store AI analysis results
ai_analysis_cache = {}

def run_pmd_analysis(file_path: str, file_extension: str) -> str:
    """
    PMD analizi çalıştırır
    """
    try:
        # Geçici rapor dosyası oluştur
        report_file = tempfile.NamedTemporaryFile(delete=False, suffix='.json')
        
        # Dosya tipine göre uygun ruleset'i seç
        if file_extension == '.java':
            ruleset = "pmd/rulesets/java.xml"
        elif file_extension == '.js':
            ruleset = "pmd/rulesets/js.xml"
        else:
            raise ValueError(f"Desteklenmeyen dosya tipi: {file_extension}")
        
        # PMD komutunu çalıştır
        command = f"/mnt/d/wsl/pmd-bin-7.13.0/bin/pmd check -d {file_path} -R {ruleset} -r {report_file.name} --format json"
        
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True
        )
        
        # Rapor dosyasını oku
        with open(report_file.name, 'r') as f:
            report_content = f.read()
        
        # Geçici rapor dosyasını sil
        os.unlink(report_file.name)
        
        if not report_content.strip():
            # Hiç ihlal yoksa, boş bir JSON döndür
            return json.dumps({
                "formatVersion": 1,
                "pmdVersion": "",
                "timestamp": "",
                "files": [],
                "suppressedViolations": [],
                "processingErrors": [],
                "configurationErrors": []
            })
        return report_content
        
    except Exception as e:
        print(f"Exception: {str(e)}")
        return f"PMD analizi sırasında hata: {str(e)}"

async def get_ai_analysis(analysis_id: str) -> Optional[str]:
    """Get AI analysis result from cache"""
    return ai_analysis_cache.get(analysis_id)

def background_ai_analysis(analysis_id: str, analysis_result: dict, tool_name: str = "PMD"):
    """Background task for AI analysis"""
    try:
        ai_comment = analyze_with_ai(analysis_result, tool_name=tool_name)
        ai_analysis_cache[analysis_id] = ai_comment
    except Exception as e:
        ai_analysis_cache[analysis_id] = f"AI analizi sırasında hata: {str(e)}"

@router.post("/analyze")
async def analyze_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    Yüklenen dosyayı analiz eder ve AI yorumunu arka planda başlatır
    """
    try:
        file_extension = os.path.splitext(file.filename)[1].lower()
        if file_extension not in ['.java', '.js']:
            return {
                "status": "error",
                "error": f"Desteklenmeyen dosya tipi: {file_extension}. Sadece .java ve .js dosyaları desteklenmektedir."
            }

        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file.flush()

            result = run_pmd_analysis(temp_file.name, file_extension)
            os.unlink(temp_file.name)

            pmd_result = result
            if isinstance(result, str):
                try:
                    pmd_result = json.loads(result)
                except Exception:
                    pmd_result = {
                        "files": [],
                        "message": result
                    }

            # Generate unique analysis ID
            analysis_id = f"pmd_{os.urandom(8).hex()}"
            
            # Start AI analysis in background
            background_tasks.add_task(background_ai_analysis, analysis_id, pmd_result)

            return {
                "status": "success",
                "file": file.filename,
                "file_type": file_extension,
                "pmd_result": pmd_result,
                "analysis_id": analysis_id
            }

    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

@router.get("/ai-status/{analysis_id}")
async def get_ai_status(analysis_id: str):
    """Get AI analysis status and result"""
    result = await get_ai_analysis(analysis_id)
    if result is None:
        return {"status": "pending"}
    return {"status": "completed", "ai_comment": result}

@router.post("/chat")
async def chat_with_ai(request: Request):
    try:
        body = await request.json()
        analysis_result = body.get("analysis_result")
        source_code = body.get("source_code")
        user_question = body.get("question")
        
        if not analysis_result or not user_question or not source_code:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing required fields"}
            )
        
        ai_response = analyze_with_ai(
            analysis_result, 
            tool_name="PMD",
            source_code=source_code,
            user_question=user_question
        )
        
        return {"response": ai_response}
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        ) 