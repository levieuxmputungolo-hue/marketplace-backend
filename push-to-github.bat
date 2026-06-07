@echo off
cd /d "C:\Users\Dell\Desktop\izaho"
echo Pousse le code vers GitHub...
echo Une fenetre de connexion GitHub va s'ouvrir.
echo Connecte-toi avec ton navigateur.
echo.
git push -u origin main
echo.
if %errorlevel%==0 (
    echo Succes ! Le code est sur GitHub.
) else (
    echo Erreur - verifie que le repo existe sur https://github.com/LEVIEUXMPUTU/marketplace-backend
)
pause
