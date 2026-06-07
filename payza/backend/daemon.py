import subprocess
import sys
import os

cmd = [
    sys.executable, "-m", "uvicorn", "app.main:app",
    "--host", "0.0.0.0", "--port", "8000"
]

subprocess.Popen(
    cmd,
    cwd=os.path.dirname(os.path.abspath(__file__)),
    stdout=open("payza.log", "w"),
    stderr=subprocess.STDOUT,
    creationflags=subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS,
)
print("Payza backend started")
