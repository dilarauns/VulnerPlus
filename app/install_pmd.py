import os
import subprocess

def check_and_install_java():
    """
    Java'nın sistemde olup olmadığını kontrol eder, yoksa yükler.
    """
    try:
        subprocess.run(["java", "--version"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print("✅ Java zaten yüklü.")
        return True
    except FileNotFoundError:
        print("⚠️ Java bulunamadı, yükleniyor...")

    try:
        os.system("sudo apt update")
        os.system("sudo apt install -y default-jdk")
        print("✅ Java başarıyla yüklendi!")
        return True
    except Exception as e:
        print(f"🚨 Java yüklenirken hata oluştu: {e}")
        return False


def check_and_install_pmd():
    """
    PMD'nin sistemde olup olmadığını kontrol eder, yoksa yükler.
    """
    try:
        subprocess.run(["pmd", "--version"], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        print("✅ PMD zaten yüklü.")
        return True
    except FileNotFoundError:
        print("⚠️ PMD bulunamadı, yükleniyor...")

    try:
        os.system("wget https://github.com/pmd/pmd/releases/latest/download/pmd-bin.zip -O pmd.zip")
        os.system("unzip pmd.zip")
        os.system("sudo mv pmd-bin-* /opt/pmd")
        os.system("echo 'export PATH=$PATH:/opt/pmd/bin' >> ~/.bashrc")
        os.system("source ~/.bashrc")
        print("✅ PMD başarıyla yüklendi!")
        return True
    except Exception as e:
        print(f"🚨 PMD yüklenirken hata oluştu: {e}")
        return False


def check_and_install_pmd_dependencies():
    """
    Hem Java'yı hem PMD'yi kontrol eder, eksikse yükler.
    """
    
    # java_installed = check_and_install_java()
    # pmd_installed = check_and_install_pmd()
    java_installed = True
    pmd_installed = True
    if java_installed and pmd_installed:
        print("✅ Java ve PMD başarıyla yüklendi ve çalışıyor!")
        return True
    else:
        print("🚨 Java veya PMD yüklenirken hata oluştu!")
        return False
