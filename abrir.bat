@echo off
title AdAnalyzer - Abrindo...
color 0A
cls

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║         AdAnalyzer — Iniciando...            ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: Encontra o caminho do arquivo HTML atual
set "HTML_FILE=%~dp0adanalyzer.html"

echo  Abrindo AdAnalyzer...
echo  Pasta: %~dp0
echo.

:: Tenta abrir o Chrome com CORS desabilitado
:: Isso resolve o problema de conexao com o Google Apps Script

set "CHROME1=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "CHROME2=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
set "CHROME3=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if exist "%CHROME1%" (
    set "CHROME=%CHROME1%"
    goto :abrir
)
if exist "%CHROME2%" (
    set "CHROME=%CHROME2%"
    goto :abrir
)
if exist "%CHROME3%" (
    set "CHROME=%CHROME3%"
    goto :abrir
)

echo  [AVISO] Chrome nao encontrado no caminho padrao.
echo  Abrindo com o navegador padrao do sistema...
start "" "%HTML_FILE%"
goto :fim

:abrir
echo  Chrome encontrado! Abrindo com permissao de conexao...
echo.
start "" "%CHROME%" --disable-web-security --disable-site-isolation-trials --user-data-dir="%TEMP%\AdAnalyzer_Chrome" "file:///%HTML_FILE:\=/%"

echo  ╔══════════════════════════════════════════════╗
echo  ║  AdAnalyzer aberto no Chrome!                ║
echo  ║                                              ║
echo  ║  Se nao abriu automaticamente, abra:         ║
echo  ║  adanalyzer.html com o Chrome                ║
echo  ╚══════════════════════════════════════════════╝
echo.

:fim
timeout /t 3 /nobreak >nul
exit
