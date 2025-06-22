import subprocess
import json
import requests
import tempfile
import os
from app.services.trivy_parser import simplify_trivy_data, generate_ai_prompt
from fastapi import UploadFile
from typing import Optional, Dict

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3"

# Store AI analysis results
ai_analysis_cache: Dict[str, str] = {}

def run_trivy_scan(image_name: str):
    """
    Trivy ile Docker imajını tarayıp JSON çıktısını döndürür.
    """
    try:
        # Önce imajın var olduğunu kontrol et
        check_image = subprocess.run(
            ["docker", "images", image_name],
            capture_output=True,
            text=True
        )
        
        if not check_image.stdout.strip():
            # İmajı sessizce çek
            subprocess.run(
                ["docker", "pull", image_name],
                capture_output=True,
                text=True
            )

        # Trivy taramasını sessiz modda yap
        command = [
            "trivy", 
            "image", 
            "--format", "json",
            "--quiet",  # Sessiz mod
            "--no-progress",  # İlerleme çubuğunu gösterme
            image_name
        ]
        
        result = subprocess.run(
            command, 
            capture_output=True, 
            text=True
        )
        
        if result.returncode != 0:
            raise RuntimeError(f"Trivy tarama hatası oluştu")

        return json.loads(result.stdout)
        
    except Exception as e:
        raise RuntimeError(f"Trivy tarama hatası: {str(e)}")

def run_trivy_scan_file(file: UploadFile):
    """
    Trivy ile dosya taraması yapar.
    """
    temp_file_path = None
    loaded_image = None
    try:
        # Create temporary file
        suffix = '.tar' if file.filename and file.filename.endswith('.tar') else ''
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file_path = temp_file.name
            file.file.seek(0)
            content = file.file.read()
            temp_file.write(content)
            temp_file.flush()
            os.fsync(temp_file.fileno())

        # Check if it's a Docker tar file
        if suffix == '.tar':
            # Load the Docker image first
            load_command = ["docker", "load", "-i", temp_file_path]
            load_result = subprocess.run(load_command, capture_output=True, text=True)
            
            if load_result.returncode != 0:
                raise RuntimeError(f"Docker load hatası: {load_result.stderr}")
            
            # Extract image name from docker load output
            output_lines = load_result.stdout.strip().split('\n')  # stdout'u kullan
            image_name = None
            
            for line in output_lines:
                if "Loaded image:" in line:
                    image_name = line.split("Loaded image: ")[1].strip()
                    loaded_image = image_name
                    break
                elif "Loaded image ID:" in line:
                    image_id = line.split("Loaded image ID: ")[1].strip()
                    # Image ID'den imaj adını al
                    inspect_command = ["docker", "inspect", "--format", "{{.RepoTags}}", image_id]
                    inspect_result = subprocess.run(inspect_command, capture_output=True, text=True)
                    if inspect_result.returncode == 0 and inspect_result.stdout.strip():
                        image_name = inspect_result.stdout.strip().strip('[]').strip('"')
                        loaded_image = image_name
                    else:
                        # Eğer RepoTags boşsa, image ID'yi kullan
                        image_name = image_id
                        loaded_image = image_id
                    break
            
            if not image_name:
                raise RuntimeError("Docker image yüklenemedi - image name bulunamadı")
            
            # Now scan the loaded image
            command = ["trivy", "image", "--format", "json", "--quiet", "--no-progress", image_name]
        else:
            # For non-tar files, use filesystem scan
            command = ["trivy", "fs", "--format", "json", "--quiet", "--no-progress", temp_file_path]

        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Trivy hatası: {result.stderr}")

        return json.loads(result.stdout)
        
    except Exception as e:
        raise RuntimeError(f"Trivy tarama hatası: {str(e)}")
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception as e:
                print(f"Failed to remove temporary file: {str(e)}")
        
        # Clean up loaded Docker image
        if loaded_image:
            try:
                subprocess.run(["docker", "rmi", loaded_image], capture_output=True, text=True)
            except Exception as e:
                print(f"Failed to remove Docker image: {str(e)}")

def background_ai_analysis(analysis_id: str, scan_result: dict):
    """
    Background task for AI analysis
    """
    try:
        # Önce veriyi sadeleştir
        simplified = simplify_trivy_data(scan_result)
        
        # AI prompt'unu sadeleştirilmiş veri ile oluştur
        prompt = generate_ai_prompt(simplified)

        data = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False
        }

        headers = {"Content-Type": "application/json"}
        response = requests.post(OLLAMA_URL, json=data, headers=headers)
        response.raise_for_status()

        response_json = response.json()
        ai_analysis_cache[analysis_id] = response_json.get("response", "AI yanıtı alınamadı.")
    except Exception as e:
        print(f"AI analysis error: {str(e)}")
        ai_analysis_cache[analysis_id] = f"AI analysis failed: {str(e)}"

async def get_ai_analysis(analysis_id: str) -> Optional[str]:
    """Get AI analysis result from cache"""
    return ai_analysis_cache.get(analysis_id)

def analyze_with_ai(scan_result: dict):
    """
    Trivy çıktısını sadeleştirip AI ile analiz eder.
    """
    # Önce veriyi sadeleştir
    simplified = simplify_trivy_data(scan_result)
    return {
        "simplified_scan": simplified,
        "ai_analysis": None  # AI analysis will be done in background
    }
