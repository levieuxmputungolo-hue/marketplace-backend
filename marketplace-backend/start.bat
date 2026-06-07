@echo off
cd /d "%~dp0"
C:\Users\Dell\AppData\Local\Programs\Python\Python311\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8004 --reload
pause
