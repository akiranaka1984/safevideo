#!/bin/bash

#################################################################################
# Firebase統合 本番環境デプロイスクリプト
# 
# 使用方法: ./deploy-firebase-integration.sh [環境] [デプロイモード]
# 環境: staging | production
# デプロイモード: canary | full | rollback
#################################################################################

set -euo pipefail

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 設定
ENVIRONMENT=${1:-staging}
DEPLOY_MODE=${2:-canary}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/deploy-${TIMESTAMP}"
LOG_FILE="deploy-${TIMESTAMP}.log"

# バージョン情報
VERSION="1.1.0-firebase"
PREVIOUS_VERSION="1.0.0"

# 関数定義
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# 事前チェック
pre_deployment_checks() {
    log "事前チェックを開始します..."
    
    # 環境変数ファイルの存在確認
    if [[ ! -f ".env.${ENVIRONMENT}" ]]; then
        error "環境変数ファイル .env.${ENVIRONMENT} が見つかりません"
    fi
    
    # Dockerサービスの確認
    if ! docker info > /dev/null 2>&1; then
        error "Dockerが起動していません"
    fi
    
    # 必要なディレクトリの作成
    mkdir -p "$BACKUP_DIR"/{db,config,logs,images}
    
    # Firebase設定の確認
    if [[ ! -f "firebase-service-account.json" ]]; then
        warning "Firebase サービスアカウントキーが見つかりません"
    fi
    
    log "事前チェックが完了しました"
}

# 現在の状態をバックアップ
backup_current_state() {
    log "現在の状態をバックアップしています..."
    
    # 環境変数のバックアップ
    cp .env.production "$BACKUP_DIR/config/env.production.backup" 2>/dev/null || true
    
    # Dockerイメージのタグ付け
    docker tag safevideo-client:latest "safevideo-client:backup-${TIMESTAMP}" || true
    docker tag safevideo-server:latest "safevideo-server:backup-${TIMESTAMP}" || true
    
    # データベースのバックアップ
    info "データベースをバックアップしています..."
    docker exec safevideo_mysql_1 mysqldump -u root -p${DB_PASSWORD} safevideo > "$BACKUP_DIR/db/safevideo-${TIMESTAMP}.sql"
    
    log "バックアップが完了しました"
}

# Dockerイメージのビルド
build_docker_images() {
    log "Dockerイメージをビルドしています..."
    
    # 環境変数を読み込む
    source ".env.${ENVIRONMENT}"
    
    # クライアントイメージのビルド
    info "クライアントイメージをビルドしています..."
    docker build \
        --build-arg REACT_APP_FIREBASE_API_KEY="${REACT_APP_FIREBASE_API_KEY}" \
        --build-arg REACT_APP_FIREBASE_AUTH_DOMAIN="${REACT_APP_FIREBASE_AUTH_DOMAIN}" \
        --build-arg REACT_APP_FIREBASE_PROJECT_ID="${REACT_APP_FIREBASE_PROJECT_ID}" \
        --build-arg REACT_APP_FIREBASE_STORAGE_BUCKET="${REACT_APP_FIREBASE_STORAGE_BUCKET}" \
        --build-arg REACT_APP_FIREBASE_MESSAGING_SENDER_ID="${REACT_APP_FIREBASE_MESSAGING_SENDER_ID}" \
        --build-arg REACT_APP_FIREBASE_APP_ID="${REACT_APP_FIREBASE_APP_ID}" \
        -t "safevideo-client:${VERSION}" \
        -f Dockerfile.firebase \
        .
    
    # サーバーイメージのビルド
    info "サーバーイメージをビルドしています..."
    docker build \
        -t "safevideo-server:${VERSION}" \
        -f server/Dockerfile.server \
        ./server
    
    # タグ付け
    docker tag "safevideo-client:${VERSION}" safevideo-client:latest
    docker tag "safevideo-server:${VERSION}" safevideo-server:latest
    
    log "Dockerイメージのビルドが完了しました"
}

# ヘルスチェック
health_check() {
    local max_attempts=30
    local attempt=0
    
    log "ヘルスチェックを実行しています..."
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f -s http://localhost:5002/api/health > /dev/null; then
            log "ヘルスチェック成功"
            return 0
        fi
        
        attempt=$((attempt + 1))
        info "ヘルスチェック試行 ${attempt}/${max_attempts}..."
        sleep 10
    done
    
    error "ヘルスチェックに失敗しました"
}

# カナリアデプロイ
canary_deployment() {
    log "カナリアデプロイを開始します（10%のトラフィック）..."
    
    # 新バージョンのコンテナを起動
    docker-compose -f docker-compose.firebase.yml up -d --scale server=2
    
    # ヘルスチェック
    health_check
    
    # トラフィックの10%を新バージョンに向ける
    info "ロードバランサーを設定しています..."
    ./scripts/configure-canary-traffic.sh 10
    
    # 30分間監視
    info "30分間のカナリア監視を開始します..."
    ./scripts/monitor-canary.sh 1800
    
    log "カナリアデプロイが完了しました"
}

# 完全デプロイ
full_deployment() {
    log "完全デプロイを開始します..."
    
    # 既存のコンテナを停止
    docker-compose down
    
    # 新バージョンを起動
    docker-compose -f docker-compose.firebase.yml up -d
    
    # ヘルスチェック
    health_check
    
    # Firebaseルールのデプロイ
    info "Firebaseセキュリティルールをデプロイしています..."
    firebase deploy --only firestore:rules,storage:rules --project "${FIREBASE_PROJECT_ID}"
    
    log "完全デプロイが完了しました"
}

# ロールバック
rollback_deployment() {
    error "ロールバックを開始します..."
    
    # 新バージョンを停止
    docker-compose -f docker-compose.firebase.yml down
    
    # 前バージョンのイメージを復元
    docker tag "safevideo-client:backup-${TIMESTAMP}" safevideo-client:latest
    docker tag "safevideo-server:backup-${TIMESTAMP}" safevideo-server:latest
    
    # 前バージョンを起動
    docker-compose up -d
    
    # データベースの復元（必要な場合）
    if [[ -f "$BACKUP_DIR/db/safevideo-${TIMESTAMP}.sql" ]]; then
        warning "データベースを復元しています..."
        docker exec -i safevideo_mysql_1 mysql -u root -p${DB_PASSWORD} safevideo < "$BACKUP_DIR/db/safevideo-${TIMESTAMP}.sql"
    fi
    
    log "ロールバックが完了しました"
}

# デプロイ後の確認
post_deployment_checks() {
    log "デプロイ後の確認を実行しています..."
    
    # API動作確認
    info "API動作確認..."
    curl -s http://localhost:5002/api/health || warning "APIヘルスチェック失敗"
    
    # Firebase認証確認
    info "Firebase認証確認..."
    ./scripts/test-firebase-auth.sh || warning "Firebase認証テスト失敗"
    
    # データベース接続確認
    info "データベース接続確認..."
    ./scripts/test-db-connection.sh || warning "データベース接続テスト失敗"
    
    # メトリクス確認
    info "メトリクス収集開始..."
    ./scripts/collect-metrics.sh &
    
    log "デプロイ後の確認が完了しました"
}

# メイン処理
main() {
    log "=== Firebase統合デプロイ開始 ==="
    log "環境: ${ENVIRONMENT}"
    log "デプロイモード: ${DEPLOY_MODE}"
    log "バージョン: ${VERSION}"
    
    # 確認プロンプト
    if [[ "$ENVIRONMENT" == "production" ]]; then
        warning "本番環境へのデプロイを実行しようとしています。"
        read -p "続行しますか？ (yes/no): " -n 3 -r
        echo
        if [[ ! $REPLY =~ ^yes$ ]]; then
            error "デプロイをキャンセルしました"
        fi
    fi
    
    # 事前チェック
    pre_deployment_checks
    
    # 現在の状態をバックアップ
    backup_current_state
    
    # デプロイモードに応じた処理
    case "$DEPLOY_MODE" in
        canary)
            build_docker_images
            canary_deployment
            info "カナリアデプロイが成功しました。完全デプロイを実行するには:"
            info "./deploy-firebase-integration.sh ${ENVIRONMENT} full"
            ;;
        full)
            build_docker_images
            full_deployment
            post_deployment_checks
            ;;
        rollback)
            rollback_deployment
            post_deployment_checks
            ;;
        *)
            error "無効なデプロイモード: ${DEPLOY_MODE}"
            ;;
    esac
    
    log "=== デプロイ完了 ==="
    log "ログファイル: ${LOG_FILE}"
    log "バックアップディレクトリ: ${BACKUP_DIR}"
}

# トラップ設定（エラー時の処理）
trap 'error "エラーが発生しました。ロールバックを検討してください。"' ERR

# メイン処理実行
main "$@"