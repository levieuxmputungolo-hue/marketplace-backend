@echo off
cd /d "%~dp0"
set MONGO_URI=mongodb+srv://marketplace_user:Aqn6K1Oza5rl87Wf@cluster0.7gjcqwp.mongodb.net/?retryWrites=true^&w=majority
C:\Users\Dell\AppData\Local\Programs\Python\Python311\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8004
pause
