# Firebase統合 ロールバック手順書

## 概要
本ドキュメントは、Firebase統合デプロイ後に問題が発生した場合の緊急ロールバック手順を記載しています。

## ロールバック判断基準

以下のいずれかの状況が発生した場合、即座にロールバックを実施：
- エラー率が通常の5倍以上に上昇
- 応答時間が10秒を超える
- データベース接続エラーが継続的に発生
- Firebase認証が機能しない
- 重大なセキュリティ脆弱性の発見

## 事前準備情報

### 前バージョン情報
```bash
# 前バージョンのDockerイメージタグ
PREVIOUS_CLIENT_IMAGE=safevideo-client:v1.0.0
PREVIOUS_SERVER_IMAGE=safevideo-server:v1.0.0

# 前バージョンの環境変数バックアップ
PREVIOUS_ENV_BACKUP=/backup/env/prod-env-backup-[DATE].tar.gz

# データベースバックアップ
DB_BACKUP_FILE=/backup/db/safevideo-prod-[DATE].sql
```

## ロールバック手順

### Phase 1: 即時対応（5分以内）

#### 1. トラフィックの切り替え
```bash
# ロードバランサーから新バージョンを除外
./scripts/lb-remove-new-version.sh

# メンテナンスページの表示
./scripts/enable-maintenance-mode.sh
```

#### 2. 現在の状態の記録
```bash
# ログの保存
docker logs safevideo_client > /backup/logs/client-rollback-$(date +%Y%m%d_%H%M%S).log
docker logs safevideo_server > /backup/logs/server-rollback-$(date +%Y%m%d_%H%M%S).log

# 現在のデータベース状態のスナップショット
mysqldump -h localhost -u root -p safevideo > /backup/db/safevideo-rollback-$(date +%Y%m%d_%H%M%S).sql
```

### Phase 2: Dockerコンテナのロールバック（10分以内）

#### 3. 新バージョンの停止
```bash
# 現在のコンテナを停止
docker-compose -f docker-compose.firebase.yml down

# イメージのタグ付け（後の分析用）
docker tag safevideo-client:latest safevideo-client:failed-$(date +%Y%m%d_%H%M%S)
docker tag safevideo-server:latest safevideo-server:failed-$(date +%Y%m%d_%H%M%S)
```

#### 4. 前バージョンの起動
```bash
# 前バージョンの環境変数を復元
tar -xzf $PREVIOUS_ENV_BACKUP -C /app/config/

# 前バージョンのdocker-composeを使用
docker-compose -f docker-compose.yml up -d

# ヘルスチェック
./scripts/health-check.sh
```

### Phase 3: データベースのロールバック（必要な場合のみ）

#### 5. データベースの復元
```bash
# 現在のデータベースのバックアップ（念のため）
mysqldump -h localhost -u root -p safevideo > /backup/db/safevideo-before-rollback-$(date +%Y%m%d_%H%M%S).sql

# Firebase関連のテーブル変更を元に戻す
mysql -h localhost -u root -p safevideo < /rollback/scripts/remove-firebase-columns.sql

# 必要に応じて完全なデータベース復元
mysql -h localhost -u root -p safevideo < $DB_BACKUP_FILE
```

### Phase 4: Firebase設定のロールバック

#### 6. Firebase設定の無効化
```bash
# Firebase設定を環境変数から削除
sed -i '/FIREBASE_/d' .env.production
sed -i '/REACT_APP_FIREBASE_/d' .env.production

# Firebaseルールを前バージョンに戻す
firebase deploy --only firestore:rules --project singular-winter-370002 --rules /backup/firebase/firestore.rules.backup
firebase deploy --only storage:rules --project singular-winter-370002 --rules /backup/firebase/storage.rules.backup
```

### Phase 5: 確認と復旧

#### 7. システム動作確認
```bash
# APIヘルスチェック
curl -X GET https://api.your-domain.com/health

# 認証機能の確認
./scripts/test-auth.sh

# データベース接続確認
./scripts/test-db-connection.sh

# 主要機能のスモークテスト
./scripts/smoke-test.sh
```

#### 8. トラフィックの復旧
```bash
# メンテナンスモードの解除
./scripts/disable-maintenance-mode.sh

# ロードバランサーに前バージョンを登録
./scripts/lb-add-previous-version.sh

# 段階的にトラフィックを戻す
./scripts/gradual-traffic-restore.sh
```

## 監視項目

ロールバック後、以下の項目を継続的に監視：

### 必須監視項目
- [ ] エラー率（5分間隔）
- [ ] 応答時間（1分間隔）
- [ ] CPU/メモリ使用率
- [ ] データベース接続数
- [ ] アクティブユーザー数

### 監視コマンド
```bash
# リアルタイム監視
watch -n 60 './scripts/monitor-rollback.sh'

# Prometheusダッシュボード
open http://localhost:9090/targets

# Grafanaダッシュボード
open http://localhost:3000/d/rollback-monitor
```

## ロールバック後の作業

### 1. インシデントレポート作成
```markdown
## インシデントレポート

**発生日時**: [YYYY-MM-DD HH:MM:SS]
**影響範囲**: [影響を受けたユーザー数/機能]
**ロールバック開始**: [HH:MM:SS]
**ロールバック完了**: [HH:MM:SS]
**根本原因**: [特定された原因]
**対策**: [今後の対策]
```

### 2. 原因分析
- ログファイルの分析
- エラートレースの確認
- パフォーマンスメトリクスの確認
- ユーザーレポートの収集

### 3. 修正計画
- 問題の修正
- テストケースの追加
- デプロイプロセスの改善

## 緊急連絡先

| 役割 | 名前 | 連絡先 | 優先度 |
|------|------|--------|--------|
| DevOpsリード | [Name] | [Phone/Email] | 1 |
| バックエンドリード | [Name] | [Phone/Email] | 2 |
| DBアドミン | [Name] | [Phone/Email] | 3 |
| セキュリティ担当 | [Name] | [Phone/Email] | 4 |

## 重要な注意事項

1. **冷静な判断**: パニックにならず、手順に従って対応する
2. **記録の重要性**: すべての操作をログに記録する
3. **コミュニケーション**: チーム全体に状況を共有する
4. **段階的復旧**: 一度にすべてを戻さず、段階的に復旧する

## 関連ドキュメント

- [Firebase統合デプロイチェックリスト](./firebase-deployment-checklist.md)
- [システムアーキテクチャ図](../system-architecture-diagram.md)
- [監視ガイド](./monitoring-guide.md)
- [セキュリティガイドライン](./security-guidelines.md)