#!/usr/bin/env bash
# =============================================================================
# elder-risk-dispatch 一键开发脚本（macOS / Linux / Git Bash）
#
# 用法：
#   ./scripts/dev.sh <command>
#
# 常用：
#   ./scripts/dev.sh            # 等同于 all：启基础设施 → 安装依赖 → 迁移 → 种子 → 起 api+admin
#   ./scripts/dev.sh up         # 仅启 Postgres + Redis + MinIO（docker compose）
#   ./scripts/dev.sh down       # 停基础设施（保留数据）
#   ./scripts/dev.sh reset      # 停 + 删卷（彻底清空数据，不可逆）
#   ./scripts/dev.sh bootstrap  # up + env + install + migrate + seed（不启动应用）
#   ./scripts/dev.sh api        # 仅起 api（:3000）
#   ./scripts/dev.sh admin      # 仅起 admin（:5173，代理 /api → :3000）
#   ./scripts/dev.sh miniapp    # 仅编译小程序（mp-weixin，需微信开发者工具打开）
#   ./scripts/dev.sh stop       # 停掉本脚本后台启动的 api + admin
#   ./scripts/dev.sh logs api   # 跟随 api 日志
#   ./scripts/dev.sh db:migrate # 跑 prisma migrate dev
#   ./scripts/dev.sh db:seed    # 跑 prisma seed
#   ./scripts/dev.sh db:reset   # prisma migrate reset（不可逆，会清库）
#   ./scripts/dev.sh env        # 拷贝 .env.example → apps/api/.env（已存在则跳过）
#
# 前置：Node>=22、pnpm>=9、Docker Desktop 在跑。
# =============================================================================
set -Eeuo pipefail

# ---------- 路径与常量 ---------------------------------------------------------
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"
API_DIR="$ROOT_DIR/apps/api"
ADMIN_DIR="$ROOT_DIR/apps/admin"
MINIAPP_DIR="$ROOT_DIR/apps/miniapp"
PID_DIR="$ROOT_DIR/.run"   # 本脚本后台进程 pid 存放
mkdir -p "$PID_DIR"

# 颜色（非交互终端自动退化）
if [ -t 1 ]; then
  C_BLUE='\033[1;34m'; C_GREEN='\033[1;32m'; C_YELLOW='\033[1;33m'; C_RED='\033[1;31m'; C_OFF='\033[0m'
else
  C_BLUE=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_OFF=''
fi

log()  { printf "${C_BLUE}▶${C_OFF} %s\n" "$*"; }
ok()   { printf "${C_GREEN}✓${C_OFF} %s\n" "$*"; }
warn() { printf "${C_YELLOW}!${C_OFF} %s\n" "$*" >&2; }
die()  { printf "${C_RED}✗${C_OFF} %s\n" "$*" >&2; exit 1; }

# ---------- 前置检查 ----------------------------------------------------------
require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "未找到命令：$1。请先安装。"
}

preflight() {
  require_cmd node
  require_cmd pnpm
  require_cmd docker
  # node 版本
  local node_major
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$node_major" -ge 22 ] || die "Node 版本需 >=22，当前 $(node -v)。建议 nvm use。"
  # docker daemon
  docker info >/dev/null 2>&1 || die "Docker daemon 未运行，请先启动 Docker Desktop。"
}

# ---------- 基础设施 ----------------------------------------------------------
cmd_up() {
  log "启动基础设施（Postgres / Redis / MinIO）..."
  docker compose -f "$COMPOSE_FILE" up -d
  wait_for_postgres
  wait_for_redis
  ok "基础设施就绪"
}

cmd_down() {
  log "停止基础设施（保留数据卷）..."
  docker compose -f "$COMPOSE_FILE" down
  ok "已停止"
}

cmd_reset() {
  warn "将删除所有数据卷（Postgres/Redis/MinIO），不可逆。"
  read -r -p "确认继续？输入 yes： " ans
  [ "$ans" = "yes" ] || { echo "已取消。"; exit 0; }
  log "停容器 + 删卷..."
  docker compose -f "$COMPOSE_FILE" down -v
  ok "已清空"
}

wait_for_postgres() {
  log "等待 Postgres 就绪..."
  for _ in $(seq 1 30); do
    if docker exec care-postgres pg_isready -U app -d care >/dev/null 2>&1; then
      ok "Postgres 就绪"; return 0
    fi
    sleep 1
  done
  die "Postgres 30s 内未就绪"
}

wait_for_redis() {
  log "等待 Redis 就绪..."
  for _ in $(seq 1 30); do
    if docker exec care-redis redis-cli ping >/dev/null 2>&1; then
      ok "Redis 就绪"; return 0
    fi
    sleep 1
  done
  die "Redis 30s 内未就绪"
}

# ---------- 环境变量 ----------------------------------------------------------
cmd_env() {
  log "初始化 apps/api/.env ..."
  if [ -f "$API_DIR/.env" ]; then
    ok "已存在 apps/api/.env，跳过（如需覆盖请手动删除）"
  elif [ -f "$ROOT_DIR/.env" ]; then
    # 根目录 .env 可能含开发者填入的真实密钥（DB/JWT/微信等），优先复用，
    # 而不是从 .env.example（空模板）拷贝。
    cp "$ROOT_DIR/.env" "$API_DIR/.env"
    ok "已从根目录 .env（含真实值）拷贝到 apps/api/.env"
  else
    cp "$ROOT_DIR/.env.example" "$API_DIR/.env"
    ok "已从 .env.example 拷贝到 apps/api/.env"
  fi
  warn "注意：.env 里的 JWT_SECRET / FIELD_ENCRYPTION_KEY 等为开发默认值，上线前务必修改。"
}

# ---------- 依赖 --------------------------------------------------------------
cmd_install() {
  log "安装依赖（pnpm install）..."
  (cd "$ROOT_DIR" && pnpm install)
  ok "依赖就绪"
}

# ---------- 数据库 ------------------------------------------------------------
prisma_generate() {
  log "prisma generate ..."
  (cd "$API_DIR" && pnpm prisma:generate)
}

cmd_db_migrate() {
  prisma_generate
  log "prisma migrate dev ..."
  (cd "$API_DIR" && pnpm prisma:migrate)
  ok "迁移完成"
}

cmd_db_seed() {
  log "prisma seed ..."
  (cd "$API_DIR" && pnpm prisma:seed)
  ok "种子完成"
}

cmd_db_reset() {
  warn "将重置数据库（drop & recreate），不可逆。"
  read -r -p "确认继续？输入 yes： " ans
  [ "$ans" = "yes" ] || { echo "已取消。"; exit 0; }
  prisma_generate
  log "prisma migrate reset ..."
  (cd "$API_DIR" && pnpm exec prisma migrate reset --force)
  ok "数据库已重置并重新迁移+种子"
}

# ---------- 应用启动 ----------------------------------------------------------
# 后台启动某 app，记录 pid；日志写到 .run/<name>.log
spawn_app() {
  local name="$1" dir="$2"; shift 2
  local logf="$PID_DIR/$name.log"
  local pidf="$PID_DIR/$name.pid"
  log "启动 $name（日志：$logf）"
  (cd "$dir" && "$@" >"$logf" 2>&1 & echo $! >"$pidf")
  sleep 1
  if kill -0 "$(cat "$pidf")" 2>/dev/null; then
    ok "$name 已启动 (pid $(cat "$pidf"))"
  else
    die "$name 启动失败，查看日志：$logf"
  fi
}

cmd_dev_api() {
  preflight
  cmd_up
  cmd_env
  [ -d "$ROOT_DIR/node_modules" ] || cmd_install
  prisma_generate
  (cd "$API_DIR" && pnpm dev)   # 前台运行，Ctrl+C 退出
}

cmd_dev_admin() {
  log "启动 admin（假定 api 已在 :3000 运行；vite 代理 /api）..."
  (cd "$ADMIN_DIR" && pnpm dev)  # 前台
}

cmd_dev_miniapp() {
  log "编译小程序到 dist/dev/mp-weixin，请用微信开发者工具打开该目录预览..."
  (cd "$MINIAPP_DIR" && pnpm dev:mp-weixin)  # 前台 watch
}

cmd_stop() {
  log "停止后台应用..."
  for name in api admin miniapp; do
    local pidf="$PID_DIR/$name.pid"
    if [ -f "$pidf" ]; then
      local pid; pid="$(cat "$pidf")"
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" && ok "已停 $name (pid $pid)"
      fi
      rm -f "$pidf"
    fi
  done
}

cmd_logs() {
  local name="${1:-api}"
  local logf="$PID_DIR/$name.log"
  [ -f "$logf" ] || die "无日志文件：$logf（该应用可能不是后台启动的）"
  log "跟随 $name 日志（Ctrl+C 退出）..."
  tail -f "$logf"
}

# ---------- bootstrap：准备但不启动应用 --------------------------------------
cmd_bootstrap() {
  preflight
  cmd_up
  cmd_env
  cmd_install
  cmd_db_migrate
  cmd_db_seed
  ok "Bootstrap 完成：基础设施 + 依赖 + DB 已就绪。可执行 ./scripts/dev.sh dev 启动应用。"
}

# ---------- all / dev：一键全启 ----------------------------------------------
# 启 api + admin 两个后台进程；小程序需微信开发者工具，不自动起。
cmd_all() {
  preflight
  cmd_up
  cmd_env
  [ -d "$ROOT_DIR/node_modules" ] || cmd_install
  prisma_generate
  # 确保 DB 已迁移
  if [ ! -d "$API_DIR/prisma/migrations" ]; then
    cmd_db_migrate
  fi
  spawn_app api   "$API_DIR"   pnpm dev
  spawn_app admin "$ADMIN_DIR" pnpm dev
  echo
  ok "全部就绪："
  echo "  API      : http://localhost:3000/api/v1"
  echo "  Swagger  : http://localhost:3000/api/docs"
  echo "  Admin    : http://localhost:5173"
  echo "  MinIO    : http://localhost:9001（minioadmin/minioadmin）"
  echo
  echo "  小程序：用微信开发者工具打开 apps/miniapp，或执行 ./scripts/dev.sh miniapp"
  echo "  停止后台应用：./scripts/dev.sh stop"
  echo "  停止基础设施：./scripts/dev.sh down"
}

# ---------- 帮助 --------------------------------------------------------------
usage() {
  # 打印文件头注释块（从第 3 行到第一个 "# =====" 单独成行处）
  awk 'NR==1{next} /^# =+$/ && NR>3 {exit} {sub(/^# ?/,""); print}' "${BASH_SOURCE[0]}"
  exit 0
}

# ---------- 入口 --------------------------------------------------------------
main() {
  local cmd="${1:-all}"
  shift || true
  case "$cmd" in
    all|dev)      cmd_all ;;
    bootstrap)    cmd_bootstrap ;;
    up)           preflight; cmd_up ;;
    down)         cmd_down ;;
    reset)        cmd_reset ;;
    env)          cmd_env ;;
    install)      cmd_install ;;
    api)          cmd_dev_api ;;
    admin)        cmd_dev_admin ;;
    miniapp)      cmd_dev_miniapp ;;
    stop)         cmd_stop ;;
    logs)         cmd_logs "${1:-}" ;;
    db:migrate)   cmd_db_migrate ;;
    db:seed)      cmd_db_seed ;;
    db:reset)     cmd_db_reset ;;
    demo-seed)    log "填充演示数据（清空现有数据后重灌）..."; (cd "$API_DIR" && pnpm seed:demo); ok "演示数据已填充" ;;
    -h|--help|help) usage ;;
    *) die "未知命令：$cmd（用 --help 查看用法）" ;;
  esac
}

main "$@"
