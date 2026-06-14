@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
REM =============================================================================
REM elder-risk-dispatch one-click dev script (Windows cmd)
REM Pure-ASCII for portability; Chinese output is fine at runtime under chcp 65001.
REM Usage: scripts\dev.cmd help
REM =============================================================================
set "ROOT_DIR=%~dp0.."
pushd "%ROOT_DIR%" >nul
set "ROOT_DIR=%CD%"
set "COMPOSE_FILE=%ROOT_DIR%\docker\docker-compose.yml"
set "API_DIR=%ROOT_DIR%\apps\api"
set "ADMIN_DIR=%ROOT_DIR%\apps\admin"
set "MINIAPP_DIR=%ROOT_DIR%\apps\miniapp"
set "PID_DIR=%ROOT_DIR%\.run"
if not exist "%PID_DIR%" mkdir "%PID_DIR%"

set "CMD=%~1"
if "%CMD%"=="" set "CMD=all"

if /i "%CMD%"=="-h" goto :usage
if /i "%CMD%"=="--help" goto :usage
if /i "%CMD%"=="help" goto :usage

REM preflight (skip for commands that don't need docker/node)
if /i not "%CMD%"=="down" if /i not "%CMD%"=="stop" if /i not "%CMD%"=="logs" if /i not "%CMD%"=="reset" (
  where node >nul 2>nul || (echo [X] node not found in PATH & exit /b 1)
  where pnpm >nul 2>nul || (echo [X] pnpm not found in PATH & exit /b 1)
  where docker >nul 2>nul || (echo [X] docker not found in PATH & exit /b 1)
  docker info >nul 2>nul || (echo [X] Docker daemon not running - start Docker Desktop first & exit /b 1)
)

if /i "%CMD%"=="up" goto :cmd_up
if /i "%CMD%"=="down" goto :cmd_down
if /i "%CMD%"=="reset" goto :cmd_reset
if /i "%CMD%"=="env" goto :cmd_env
if /i "%CMD%"=="install" goto :cmd_install
if /i "%CMD%"=="bootstrap" goto :cmd_bootstrap
if /i "%CMD%"=="all" goto :cmd_all
if /i "%CMD%"=="dev" goto :cmd_all
if /i "%CMD%"=="api" goto :cmd_api
if /i "%CMD%"=="admin" goto :cmd_admin
if /i "%CMD%"=="miniapp" goto :cmd_miniapp
if /i "%CMD%"=="stop" goto :cmd_stop
if /i "%CMD%"=="logs" goto :cmd_logs
if /i "%CMD%"=="db:migrate" goto :cmd_db_migrate
if /i "%CMD%"=="db:seed" goto :cmd_db_seed
if /i "%CMD%"=="db:reset" goto :cmd_db_reset
echo [X] unknown command: %CMD% (run with 'help')
exit /b 1

REM ===========================================================================
REM subroutines (called via 'call', each ends with goto :eof)
REM ===========================================================================

:do_up
echo [^>] starting infra (Postgres / Redis / MinIO)...
docker compose -f "%COMPOSE_FILE%" up -d
call :wait_pg
call :wait_redis
echo [v] infra ready
goto :eof

:wait_pg
echo [^>] waiting for Postgres...
set /a _t=0
:_wpg
docker exec care-postgres pg_isready -U app -d care >nul 2>nul && (echo [v] Postgres ready & goto :eof)
set /a _t+=1
if !_t! lss 60 (ping -n 2 127.0.0.1 >nul & goto :_wpg)
echo [X] Postgres not ready within 60s
exit /b 1

:wait_redis
echo [^>] waiting for Redis...
set /a _t=0
:_wr
docker exec care-redis redis-cli ping >nul 2>nul && (echo [v] Redis ready & goto :eof)
set /a _t+=1
if !_t! lss 60 (ping -n 2 127.0.0.1 >nul & goto :_wr)
echo [X] Redis not ready within 60s
exit /b 1

:do_env
if exist "%API_DIR%\.env" (
  echo [v] apps\api\.env already exists, skip
) else (
  copy "%ROOT_DIR%\.env.example" "%API_DIR%\.env" >nul
  echo [v] copied .env.example to apps\api\.env
)
goto :eof

:do_install
echo [^>] installing deps (pnpm install)...
call pnpm install
echo [v] deps ready
goto :eof

:do_prisma_generate
pushd "%API_DIR%" >nul
call pnpm prisma:generate
popd >nul
goto :eof

:do_migrate
call :do_prisma_generate
echo [^>] prisma migrate dev ...
pushd "%API_DIR%" >nul
call pnpm prisma:migrate
popd >nul
echo [v] migrate done
goto :eof

:do_seed
echo [^>] prisma seed ...
pushd "%API_DIR%" >nul
call pnpm prisma:seed
popd >nul
echo [v] seed done
goto :eof

REM ===========================================================================
REM command implementations
REM ===========================================================================

:cmd_up
call :do_up
goto :done

:cmd_down
echo [^>] stopping infra (keep data volumes)...
docker compose -f "%COMPOSE_FILE%" down
echo [v] stopped
goto :done

:cmd_reset
echo [WARN] this will DELETE all data volumes (Postgres/Redis/MinIO) - irreversible
set /p ans="type yes to continue: "
if /i not "%ans%"=="yes" (echo cancelled. & goto :done)
echo [^>] stopping containers + removing volumes...
docker compose -f "%COMPOSE_FILE%" down -v
echo [v] wiped
goto :done

:cmd_env
call :do_env
echo [WARN] JWT_SECRET / FIELD_ENCRYPTION_KEY in .env are dev defaults - change before production
goto :done

:cmd_install
call :do_install
goto :done

:cmd_db_migrate
call :do_migrate
goto :done

:cmd_db_seed
call :do_seed
goto :done

:cmd_db_reset
echo [WARN] this will RESET the database (drop ^& recreate) - irreversible
set /p ans="type yes to continue: "
if /i not "%ans%"=="yes" (echo cancelled. & goto :done)
call :do_prisma_generate
echo [^>] prisma migrate reset ...
pushd "%API_DIR%" >nul
call pnpm exec prisma migrate reset --force
popd >nul
echo [v] database reset (migrated + seeded)
goto :done

:cmd_bootstrap
call :do_up
call :do_env
call :do_install
call :do_migrate
call :do_seed
echo [v] bootstrap done: infra + deps + DB ready. run scripts\dev.cmd dev to start apps
goto :done

:cmd_all
call :do_up
call :do_env
if not exist "%ROOT_DIR%\node_modules" call :do_install
call :do_prisma_generate
if not exist "%API_DIR%\prisma\migrations" call :do_migrate
echo [^>] starting api (log .run\api.log)...
start "care-api" /D "%API_DIR%" /MIN cmd /c "pnpm dev > ""%PID_DIR%\api.log"" 2>&1"
echo api > "%PID_DIR%\api.pid"
echo [^>] starting admin (log .run\admin.log)...
start "care-admin" /D "%ADMIN_DIR%" /MIN cmd /c "pnpm dev > ""%PID_DIR%\admin.log"" 2>&1"
echo admin > "%PID_DIR%\admin.pid"
echo.
echo [v] all up:
echo     API      : http://localhost:3000/api/v1
echo     Swagger  : http://localhost:3000/api/docs
echo     Admin    : http://localhost:5173
echo     MinIO    : http://localhost:9001 (minioadmin/minioadmin)
echo.
echo     miniapp: open apps\miniapp in WeChat devtools, or run scripts\dev.cmd miniapp
echo     stop apps:    scripts\dev.cmd stop
echo     stop infra:   scripts\dev.cmd down
goto :done

:cmd_api
call :do_up
call :do_env
if not exist "%ROOT_DIR%\node_modules" call :do_install
call :do_prisma_generate
echo [^>] starting api (foreground, Ctrl+C to exit)...
pushd "%API_DIR%" >nul
call pnpm dev
popd >nul
goto :done

:cmd_admin
echo [^>] starting admin (assume api on :3000; vite proxies /api)...
pushd "%ADMIN_DIR%" >nul
call pnpm dev
popd >nul
goto :done

:cmd_miniapp
echo [^>] building miniapp to dist\dev\mp-weixin; open it in WeChat devtools to preview...
pushd "%MINIAPP_DIR%" >nul
call pnpm dev:mp-weixin
popd >nul
goto :done

:cmd_stop
echo [^>] stopping background apps...
for %%N in (api admin miniapp) do (
  if exist "%PID_DIR%\%%N.pid" (
    taskkill /FI "WINDOWTITLE eq care-%%N*" /T /F >nul 2>nul
    del "%PID_DIR%\%%N.pid" >nul 2>nul
    echo [v] stopped %%N
  )
)
goto :done

:cmd_logs
set "LNAME=%~2"
if "%LNAME%"=="" set "LNAME=api"
if not exist "%PID_DIR%\%LNAME%.log" (echo [X] no log file: %PID_DIR%\%LNAME%.log & exit /b 1)
echo [^>] tailing %LNAME% log (Ctrl+C to exit)...
powershell -NoProfile -Command "Get-Content -Wait -Path '%PID_DIR%\%LNAME%.log'"
goto :done

:usage
echo Usage: scripts\dev.cmd ^<command^>
echo.
echo Common:
echo   scripts\dev.cmd            start infra+install+migrate+seed, launch api+admin (bg)
echo   scripts\dev.cmd up         start Postgres + Redis + MinIO only
echo   scripts\dev.cmd down       stop infra (keep data)
echo   scripts\dev.cmd reset      stop + delete volumes (IRREVERSIBLE)
echo   scripts\dev.cmd bootstrap  up + env + install + migrate + seed (no apps)
echo   scripts\dev.cmd api        run api only (:3000, foreground)
echo   scripts\dev.cmd admin      run admin only (:5173, foreground)
echo   scripts\dev.cmd miniapp    build miniapp (mp-weixin)
echo   scripts\dev.cmd stop       stop background api+admin
echo   scripts\dev.cmd logs api   tail api log
echo   scripts\dev.cmd db:migrate prisma migrate dev
echo   scripts\dev.cmd db:seed    prisma seed
echo   scripts\dev.cmd db:reset   prisma migrate reset (IRREVERSIBLE)
echo   scripts\dev.cmd env        copy .env.example -^> apps\api\.env
echo.
echo Prereqs: Node^>=22, pnpm^>=9, Docker Desktop running.
exit /b 0

:done
popd >nul
endlocal
