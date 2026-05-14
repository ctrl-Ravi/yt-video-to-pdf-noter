@echo off

start powershell -NoExit -ExecutionPolicy Bypass -Command "cd 'D:\Coding file\yt-noter-v2\yt-noter-v2'; .\venv\Scripts\Activate.ps1; cd backend; python app.py"