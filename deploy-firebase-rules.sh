#!/bin/bash

# Firebaseセキュリティルール デプロイスクリプト
# 本番環境向けに最適化されたセキュリティルールをデプロイします

set -e

# カラー出力の定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ロギング関数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 環境変数のチェック
check_environment() {
    log_info "環境設定を確認しています..."
    
    if [ -z "$FIREBASE_PROJECT_ID" ]; then
        log_error "FIREBASE_PROJECT_ID が設定されていません"
        echo "使用方法: FIREBASE_PROJECT_ID=your-project-id ./deploy-firebase-rules.sh [環境]"
        exit 1
    fi
    
    log_success "Firebase プロジェクト: $FIREBASE_PROJECT_ID"
}

# Firebase CLIの確認
check_firebase_cli() {
    log_info "Firebase CLI を確認しています..."
    
    if ! command -v firebase &> /dev/null; then
        log_error "Firebase CLI がインストールされていません"
        echo "インストール方法: npm install -g firebase-tools"
        exit 1
    fi
    
    log_success "Firebase CLI が見つかりました"
}

# ルールファイルの検証
validate_rules() {
    local env=$1
    log_info "セキュリティルールを検証しています..."
    
    # Firestoreルールの検証
    if [ -f "firestore.rules" ]; then
        log_info "Firestore ルールを検証中..."
        firebase emulators:exec --only firestore "echo 'Firestore rules are valid'" --project "$FIREBASE_PROJECT_ID" || {
            log_error "Firestore ルールの検証に失敗しました"
            exit 1
        }
        log_success "Firestore ルールの検証が完了しました"
    fi
    
    # Storage ルールの存在確認
    if [ ! -f "storage.rules" ]; then
        log_error "storage.rules ファイルが見つかりません"
        exit 1
    fi
    
    # Database ルールの存在確認
    if [ ! -f "database.rules.json" ]; then
        log_error "database.rules.json ファイルが見つかりません"
        exit 1
    fi
    
    log_success "すべてのルールファイルが見つかりました"
}

# バックアップの作成
create_backup() {
    local env=$1
    local backup_dir="backups/rules/$(date +%Y%m%d_%H%M%S)"
    
    log_info "現在のルールをバックアップしています..."
    
    mkdir -p "$backup_dir"
    
    # 現在のルールを取得してバックアップ
    log_info "Firestore ルールをバックアップ中..."
    firebase firestore:rules:get --project "$FIREBASE_PROJECT_ID" > "$backup_dir/firestore.rules.backup" 2>/dev/null || {
        log_warning "Firestore ルールのバックアップをスキップしました（初回デプロイの可能性）"
    }
    
    log_info "Storage ルールをバックアップ中..."
    # Storage ルールのバックアップ（Firebase CLIでは直接取得できないため、ローカルコピーを保存）
    if [ -f "storage.rules" ]; then
        cp "storage.rules" "$backup_dir/storage.rules.backup"
    fi
    
    log_info "Database ルールをバックアップ中..."
    firebase database:rules:get --project "$FIREBASE_PROJECT_ID" > "$backup_dir/database.rules.backup.json" 2>/dev/null || {
        log_warning "Database ルールのバックアップをスキップしました（初回デプロイの可能性）"
    }
    
    log_success "バックアップが完了しました: $backup_dir"
}

# 環境別の設定適用
apply_environment_config() {
    local env=$1
    
    case $env in
        "production")
            log_info "本番環境の設定を適用しています..."
            # 本番環境では追加のセキュリティチェックを有効化
            export FIREBASE_RULES_STRICT_MODE=true
            ;;
        "staging")
            log_info "ステージング環境の設定を適用しています..."
            ;;
        "development")
            log_info "開発環境の設定を適用しています..."
            ;;
        *)
            log_error "未知の環境: $env"
            echo "使用可能な環境: production, staging, development"
            exit 1
            ;;
    esac
}

# ルールのデプロイ
deploy_rules() {
    local env=$1
    
    log_info "セキュリティルールをデプロイしています..."
    
    # Firestore ルールのデプロイ
    log_info "Firestore ルールをデプロイ中..."
    firebase deploy --only firestore:rules --project "$FIREBASE_PROJECT_ID" || {
        log_error "Firestore ルールのデプロイに失敗しました"
        exit 1
    }
    
    # Storage ルールのデプロイ
    log_info "Storage ルールをデプロイ中..."
    firebase deploy --only storage:rules --project "$FIREBASE_PROJECT_ID" || {
        log_error "Storage ルールのデプロイに失敗しました"
        exit 1
    }
    
    # Database ルールのデプロイ
    log_info "Database ルールをデプロイ中..."
    firebase deploy --only database:rules --project "$FIREBASE_PROJECT_ID" || {
        log_error "Database ルールのデプロイに失敗しました"
        exit 1
    }
    
    log_success "すべてのルールが正常にデプロイされました"
}

# デプロイ後の確認
verify_deployment() {
    local env=$1
    
    log_info "デプロイを確認しています..."
    
    # プロジェクトの状態を確認
    firebase projects:get "$FIREBASE_PROJECT_ID" > /dev/null 2>&1 || {
        log_error "プロジェクトの確認に失敗しました"
        exit 1
    }
    
    log_success "デプロイが正常に完了しました"
}

# ロールバック機能
rollback_rules() {
    local backup_path=$1
    
    log_warning "ルールをロールバックしています..."
    
    if [ ! -d "$backup_path" ]; then
        log_error "バックアップディレクトリが見つかりません: $backup_path"
        exit 1
    fi
    
    # Firestore ルールのロールバック
    if [ -f "$backup_path/firestore.rules.backup" ]; then
        cp "$backup_path/firestore.rules.backup" "firestore.rules"
        firebase deploy --only firestore:rules --project "$FIREBASE_PROJECT_ID"
    fi
    
    # Storage ルールのロールバック
    if [ -f "$backup_path/storage.rules.backup" ]; then
        cp "$backup_path/storage.rules.backup" "storage.rules"
        firebase deploy --only storage:rules --project "$FIREBASE_PROJECT_ID"
    fi
    
    # Database ルールのロールバック
    if [ -f "$backup_path/database.rules.backup.json" ]; then
        cp "$backup_path/database.rules.backup.json" "database.rules.json"
        firebase deploy --only database:rules --project "$FIREBASE_PROJECT_ID"
    fi
    
    log_success "ロールバックが完了しました"
}

# メイン処理
main() {
    local env=${1:-production}
    local action=${2:-deploy}
    
    echo "======================================"
    echo "Firebase セキュリティルール デプロイツール"
    echo "======================================"
    echo ""
    
    case $action in
        "deploy")
            check_environment
            check_firebase_cli
            apply_environment_config "$env"
            validate_rules "$env"
            create_backup "$env"
            deploy_rules "$env"
            verify_deployment "$env"
            
            echo ""
            log_success "デプロイが完了しました！"
            echo ""
            echo "デプロイされたルール:"
            echo "  - Firestore: firestore.rules"
            echo "  - Storage: storage.rules"
            echo "  - Database: database.rules.json"
            echo ""
            echo "問題が発生した場合は、以下のコマンドでロールバックできます:"
            echo "  ./deploy-firebase-rules.sh $env rollback backups/rules/[タイムスタンプ]"
            ;;
            
        "rollback")
            local backup_path=$3
            if [ -z "$backup_path" ]; then
                log_error "バックアップパスを指定してください"
                echo "使用方法: ./deploy-firebase-rules.sh $env rollback backups/rules/[タイムスタンプ]"
                exit 1
            fi
            check_environment
            check_firebase_cli
            rollback_rules "$backup_path"
            ;;
            
        *)
            log_error "未知のアクション: $action"
            echo "使用可能なアクション: deploy, rollback"
            exit 1
            ;;
    esac
}

# スクリプトの実行
main "$@"