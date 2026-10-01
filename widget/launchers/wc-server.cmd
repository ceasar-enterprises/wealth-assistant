@echo off
rem Wealth Command - bridge server (local data layer on 127.0.0.1:4170)
cd /d "%~dp0.."
node src\server.js > data\server-console.log 2>&1