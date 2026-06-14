@echo off
cd /d "%~dp0"
if exist .env for /f "usebackq delims=" %%a in (.env) do set %%a
C:\Users\Dell\AppData\Local\Programs\Python\Python311\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8004 --reload
pause
