import subprocess

def simplify_trivy_data(scan_result: dict) -> dict:
    """
    Trivy tarama sonuçlarını sadece gerekli bilgileri içerecek şekilde sadeleştirir.
    """
    simplified = {
        "scan_result": {
            "Results": []
        }
    }

    for result in scan_result.get("Results", []):
        simplified_result = {
            "Target": result.get("Target"),
            "Type": result.get("Type"),
            "Vulnerabilities": []
        }

        for vuln in result.get("Vulnerabilities", []):
            # Sadece ihtiyacımız olan alanları alıyoruz
            simplified_vuln = {
                "VulnerabilityID": vuln.get("VulnerabilityID"),
                "PkgName": vuln.get("PkgName"),
                "InstalledVersion": vuln.get("InstalledVersion"),
                "FixedVersion": vuln.get("FixedVersion"),
                "Severity": vuln.get("Severity"),
                "Title": vuln.get("Title"),  # Açığın başlığı
                "Description": vuln.get("Description")  # Açığın açıklaması
            }
            simplified_result["Vulnerabilities"].append(simplified_vuln)

        simplified["scan_result"]["Results"].append(simplified_result)
    return simplified

def generate_ai_prompt(simplified_data: dict) -> str:
    """
    Sadeleştirilmiş Trivy verilerinden AI prompt'u oluşturur.
    """
    prompt = """
Please analyze the following security findings and present the results in a clear, visually distinct markdown format.

For each vulnerability, list:
- The **ID** (bold)
- The *package and short description* (italic)
- A short impact/mitigation note as a blockquote

At the end of each severity section, add a one-sentence recommendation in a blockquote.

Use markdown, so that the output is visually clear when rendered.

Here is the data to analyze:
"""

    for result in simplified_data.get("scan_result", {}).get("Results", []):
        target = result.get("Target", "Unknown Target")
        prompt += f"\nTarget: {target}\n"
        vulnerabilities = result.get("Vulnerabilities", [])
        if not vulnerabilities:
            prompt += "No vulnerabilities found.\n"
            continue
        for vuln in vulnerabilities:
            prompt += f"- ID: {vuln.get('VulnerabilityID')}, Package: {vuln.get('PkgName')}, Severity: {vuln.get('Severity')}, Title: {vuln.get('Title')}\n"
    prompt += "\n"
    return prompt

def cleanup_image(image_name: str):
    subprocess.run(["docker", "rmi", image_name])
