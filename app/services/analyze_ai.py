import requests
import json

OLLAMA_URL = "http://localhost:11434/api/generate"
OLLAMA_MODEL = "llama3"

def analyze_with_ai(analysis_result, tool_name: str, source_code: str = None, user_question: str = None) -> str:
    """
    Analiz sonucunu ve kaynak kodu AI ile değerlendirir
    """
    try:
        if user_question:
            prompt = f"""
            Analiz aracı: {tool_name}
            
            Kaynak kod:
            ```
            {source_code}
            ```
            
            Analiz sonucu:
            {json.dumps(analysis_result, indent=2)}
            
            Kullanıcı sorusu: {user_question}
            
            Lütfen kullanıcının sorusuna yanıt verirken:
            1. Analiz sonuçlarını detaylı açıkla
            2. Hataları düzeltmek için örnek kod parçaları göster
            3. Önerilen değişiklikleri açıkla
            4. Güvenlik açıklarını nasıl kapatacağını belirt
            """
        else:
            prompt = f"""
            Analiz aracı: {tool_name}
            
            Kaynak kod:
            ```
            {source_code}
            ```
            
            Analiz sonucu:
            {json.dumps(analysis_result, indent=2)}
            
            Lütfen bu analiz sonuçlarını değerlendir:
            1. Tespit edilen sorunları açıkla
            2. Her sorun için düzeltme önerileri sun
            3. Örnek düzeltilmiş kod parçaları göster
            4. Güvenlik açıklarını nasıl kapatacağını belirt
            """

        response = call_ai_model(prompt)
        return response

    except Exception as e:
        return f"AI analizi sırasında hata oluştu: {str(e)}"

def call_ai_model(prompt: str) -> str:
    data = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False
    }

    headers = {"Content-Type": "application/json"}
    response = requests.post(OLLAMA_URL, json=data, headers=headers)
    response.raise_for_status()

    response_json = response.json()
    return response_json.get("response", "AI yanıtı alınamadı.") 