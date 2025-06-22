import subprocess
import os
import tempfile
import shutil
import json
from fastapi import APIRouter, UploadFile, File, Request, BackgroundTasks
from app.services.analyze_ai import analyze_with_ai
from fastapi.responses import JSONResponse
from typing import Optional

router = APIRouter()

# Store AI analysis results
ai_analysis_cache = {}

def run_infer_analysis(file_path: str, file_extension: str) -> str:
    """
    Infer ile C/C++ analizi yapar
    """
    try:
        # Geçici klasör oluştur
        with tempfile.TemporaryDirectory() as temp_dir:
            # Dosyayı temp_dir'e KOPYALA (taşıma değil!)
            base_name = os.path.basename(file_path)
            target_path = os.path.join(temp_dir, base_name)
            shutil.copy(file_path, target_path)

            # Infer komutunu hazırla
            command = f"infer run -- gcc -c {target_path}"
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                cwd=temp_dir
            )

            # Infer raporunu oku
            report_path = os.path.join(temp_dir, "infer-out", "report.json")
            if os.path.exists(report_path):
                with open(report_path, "r") as f:
                    return f.read()
            else:
                return "Infer raporu bulunamadı veya analizde hata oluştu."
    except Exception as e:
        return f"Infer analizi sırasında hata: {str(e)}"

async def get_ai_analysis(analysis_id: str) -> Optional[str]:
    """Get AI analysis result from cache"""
    return ai_analysis_cache.get(analysis_id)

def background_ai_analysis(analysis_id: str, analysis_result: dict, tool_name: str = "Infer"):
    """Background task for AI analysis"""
    try:
        ai_comment = analyze_with_ai(analysis_result, tool_name=tool_name)
        ai_analysis_cache[analysis_id] = ai_comment
    except Exception as e:
        ai_analysis_cache[analysis_id] = f"AI analizi sırasında hata: {str(e)}"

@router.post("/analyze")
async def analyze_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    Yüklenen C/C++ dosyasını analiz eder ve AI yorumunu arka planda başlatır
    """
    try:
        file_extension = os.path.splitext(file.filename)[1].lower()
        if file_extension not in ['.c', '.cpp']:
            return {
                "status": "error",
                "error": f"Desteklenmeyen dosya tipi: {file_extension}. Sadece .c ve .cpp dosyaları desteklenmektedir."
            }

        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file.flush()

            result = run_infer_analysis(temp_file.name, file_extension)
            os.unlink(temp_file.name)

            infer_result = result
            if isinstance(result, str):
                try:
                    infer_result = json.loads(result)
                except Exception:
                    infer_result = result

            # Generate unique analysis ID
            analysis_id = f"infer_{os.urandom(8).hex()}"
            
            # Start AI analysis in background
            background_tasks.add_task(background_ai_analysis, analysis_id, infer_result)

            return {
                "status": "success",
                "file": file.filename,
                "file_type": file_extension,
                "infer_result": infer_result,
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

@router.post("/ai-comment")
async def ai_comment(request: Request):
    body = await request.json()
    result = body.get("result")
    ai_comment = analyze_with_ai(result, tool_name="Infer")
    return {"ai_comment": ai_comment}

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
            tool_name="Infer",
            source_code=source_code,
            user_question=user_question
        )
        
        return {"response": ai_response}
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        ) 