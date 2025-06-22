import os
import subprocess

def check_and_install_trivy():
    """
    Trivy'nin sistemde olup olmadığını kontrol eder, yoksa yükler.
    """
    try:
        subprocess.run(["trivy", "-v"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print("✅ Trivy zaten yüklü.")
        return True
    except FileNotFoundError:
        print("⚠️ Trivy bulunamadı, yükleniyor...")
    except subprocess.CalledProcessError:
        print("⚠️ Trivy hatalı veya eksik, tekrar yükleniyor...")

    try:
        os.system("wget https://github.com/aquasecurity/trivy/releases/latest/download/trivy_amd64.deb -O trivy.deb")
        os.system("sudo dpkg -i trivy.deb")
        print("✅ Trivy başarıyla yüklendi!")
        return True
    except Exception as e:
        print(f"🚨 Trivy yüklenirken hata oluştu: {e}")
        return False
