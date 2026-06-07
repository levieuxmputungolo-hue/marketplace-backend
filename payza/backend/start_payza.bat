@echo off
cd /d C:\Users\Dell\Desktop\izaho\payza\backend
C:\Users\Dell\AppData\Local\Programs\Python\Python311\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
