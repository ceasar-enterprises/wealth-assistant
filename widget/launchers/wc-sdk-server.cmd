@echo off
rem Wealth Command - SDK REST server (developer hook on 127.0.0.1:4171)
cd /d "%~dp0..\..\sdk"
node dist\cli.js serve > data\sdk-console.log 2>&1