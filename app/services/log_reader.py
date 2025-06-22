import json
import requests
from app.config import FALCO_LOG_PATH

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3" 

def read_falco_logs(lines=10):
    """
    Falco loglarını oku ve son 'n' satırı döndür.
    """
    try:
        with open(FALCO_LOG_PATH, "r") as file:
            logs = file.readlines()
            last_logs = logs[-lines:] 
            return [json.loads(log) for log in last_logs] 
    except Exception as e:
        return {"error": str(e)}

def analyze_logs_ollama(logs):
    """
    Falco loglarını AI ile analiz eder.
    """
    if not logs:
        return {"error": "Analiz edilecek log bulunamadı."}


    prompt = (
        "Aşağıdaki güvenlik loglarını analiz et ve potansiyel tehditleri tespit et. "
        "Şüpheli aktiviteleri belirt ve güvenlik önerileri sun:\n\n"
    )


    formatted_logs = json.dumps(logs, indent=4)

    data = {
        "prompt": prompt + formatted_logs,
        "model": OLLAMA_MODEL,
        "stream": False
    }
    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(OLLAMA_URL, json=data, headers=headers)
        response.raise_for_status() 
        

        response_json = response.json()
        if "response" in response_json:
            return response_json["response"]
        else:
            return {"error": "AI yanıtında 'response' anahtarı bulunamadı."}

    except requests.exceptions.RequestException as e:
        return {"error": f"Ollama API hatası: {str(e)}"}
