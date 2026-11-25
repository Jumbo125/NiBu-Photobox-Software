@echo off
cd /d "%~dp0"
python.exe -m pip install --target "Lib\site-packages" -r requirements.txt
