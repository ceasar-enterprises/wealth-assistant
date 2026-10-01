@echo off
rem Wealth Command - Electron tile (starts its own bridge if :4170 is dark)
cd /d "%~dp0.."
node_modules\.bin\electron.cmd src\main.js > data\tile-console.log 2>&1