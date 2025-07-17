# SafeVideo 本番環境デプロイメントガイド

## 概要

本ドキュメントは、SafeVideoシステムの本番環境への完全なデプロイメント手順を説明します。ブルーグリーンデプロイメント、高可用性設定、監視システム、セキュリティ強化を含む包括的なガイドです。

## 🎯 デプロイメント戦略

### ブルーグリーンデプロイメント
- **Blue環境**: 現在の本番環境
- **Green環境**: 新バージョンのテスト・切り替え環境
- **ゼロダウンタイム**: 瞬間的な環境切り替え
- **即座のロールバック**: 問題発生時の迅速な復旧

### 高可用性アーキテクチャ
```
┌─────────────────────────────────────────────┐
│              Load Balancer (HAProxy)       │
├─────────────────────────────────────────────┤
│  Blue Environment    │  Green Environment   │
│  (3 replicas)       │  (0-3 replicas)      │
├─────────────────────────────────────────────┤
│           MySQL Master-Replica             │
│              Redis Cluster                  │
├─────────────────────────────────────────────┤
│     Prometheus + Grafana + Alertmanager    │
└─────────────────────────────────────────────┘
```

## 📋 デプロイメント前の準備

### 1. システム要件確認

#### ハードウェア要件
- **CPU**: 最小16コア（推奨32コア）
- **メモリ**: 最小32GB（推奨64GB）
- **ストレージ**: 最小500GB SSD（推奨1TB NVMe）
- **ネットワーク**: 1Gbps接続（推奨10Gbps）

#### ソフトウェア要件
- **OS**: Ubuntu 20.04 LTS または CentOS 8+
- **Docker**: 20.10.0+
- **Docker Compose**: 1.29.0+
- **Docker Swarm**: 有効
- **SSL証明書**: 有効なSSL/TLS証明書

### 2. 環境変数設定

```bash
# 必須環境変数
export DOMAIN="safevideo.com"
export VERSION="v1.0.0"
export DB_NAME="safevideo_prod"
export DB_USER="safevideo_user"
export LOG_LEVEL="warn"
export NFS_SERVER="nfs.internal.com"
export BACKUP_SERVER="backup.internal.com"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/..."
```

### 3. シークレット管理

```bash
# シークレットファイル作成
mkdir -p ./secrets

# データベースパスワード
echo "$(openssl rand -base64 32)" > ./secrets/mysql_root_password.txt
echo "$(openssl rand -base64 24)" > ./secrets/db_password.txt

# アプリケーションシークレット
echo "$(openssl rand -base64 64)" > ./secrets/jwt_secret.txt
echo "$(openssl rand -base64 32)" > ./secrets/encryption_key.txt

# Redis認証
echo "$(openssl rand -base64 24)" > ./secrets/redis_password.txt

# Grafana管理者パスワード
echo "$(openssl rand -base64 16)" > ./secrets/grafana_password.txt

# 権限設定
chmod 600 ./secrets/*.txt
```

## 🚀 デプロイメント手順

### Phase 1: インフラストラクチャ準備

#### 1.1 Docker Swarmクラスタ初期化
```bash
# マスターノードでSwarm初期化
docker swarm init --advertise-addr <MANAGER_IP>

# ワーカーノード追加
docker swarm join --token <TOKEN> <MANAGER_IP>:2377

# ノードラベル設定
docker node update --label-add environment=production node1
docker node update --label-add database=master node2
docker node update --label-add database=replica node3
docker node update --label-add redis=cluster node4
```

#### 1.2 ネットワーク作成
```bash
# オーバーレイネットワーク作成
docker network create --driver overlay --encrypted frontend
docker network create --driver overlay --encrypted --internal backend
docker network create --driver overlay --encrypted --internal database
docker network create --driver overlay --encrypted monitoring
```

#### 1.3 ストレージ準備
```bash
# NFSマウント設定
sudo mount -t nfs4 ${NFS_SERVER}:/exports/safevideo /mnt/safevideo

# データベース専用ストレージ
sudo mkfs.ext4 /dev/sdb1
sudo mount /dev/sdb1 /var/lib/mysql-data
```

### Phase 2: セキュリティ設定

#### 2.1 SSL証明書配置
```bash
# SSL証明書配置
sudo mkdir -p /etc/ssl/certs/safevideo
sudo cp safevideo.crt /etc/ssl/certs/safevideo/
sudo cp safevideo.key /etc/ssl/certs/safevideo/
sudo chmod 644 /etc/ssl/certs/safevideo/safevideo.crt
sudo chmod 600 /etc/ssl/certs/safevideo/safevideo.key
```

#### 2.2 ファイアウォール設定
```bash
# UFW設定（Ubuntu）
sudo ufw enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 2377/tcp  # Docker Swarm
sudo ufw allow 7946/tcp  # Docker Swarm
sudo ufw allow 4789/udp  # Docker Overlay
```

### Phase 3: 監視システムデプロイ

#### 3.1 監視設定生成
```bash
# 監視設定作成
./deploy/monitoring-setup.sh

# Slack Webhookを設定
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
sed -i "s|\${SLACK_WEBHOOK_URL}|$SLACK_WEBHOOK_URL|g" monitoring/alertmanager/alertmanager.yml
```

#### 3.2 監視スタックデプロイ
```bash
# 監視サービス開始
docker stack deploy -c docker/production/docker-compose.production.yml safevideo-monitoring

# サービス状態確認
docker service ls
docker service logs safevideo-monitoring_prometheus
```

### Phase 4: アプリケーションデプロイ

#### 4.1 イメージビルド
```bash
# アプリケーションイメージビルド
docker build -t safevideo/client:${VERSION} -f Dockerfile.optimized .
docker build -t safevideo/server:${VERSION} -f server/Dockerfile.optimized ./server

# レジストリにプッシュ
docker push safevideo/client:${VERSION}
docker push safevideo/server:${VERSION}
```

#### 4.2 データベース初期化
```bash
# データベーススタック先行デプロイ
docker stack deploy -c docker/production/docker-compose.production.yml safevideo-db

# データベース初期化待機
sleep 60

# マイグレーション実行
docker exec -it $(docker ps -q -f name=safevideo-db_mysql-master) \
  mysql -u root -p${MYSQL_ROOT_PASSWORD} < ./database/schema.sql
```

#### 4.3 アプリケーションスタックデプロイ
```bash
# 完全スタックデプロイ
docker stack deploy -c docker/production/docker-compose.production.yml safevideo

# デプロイ確認
docker service ls | grep safevideo
docker stack ps safevideo
```

## 🔄 ブルーグリーンデプロイメント実行

### 自動デプロイメント
```bash
# 最新版を自動判定してデプロイ
./deploy/blue-green-deploy.sh

# 特定バージョンをBlue環境にデプロイ
./deploy/blue-green-deploy.sh blue v1.2.3

# ドライラン実行
DRY_RUN=true ./deploy/blue-green-deploy.sh green v1.2.3
```

### 手動デプロイメント

#### 1. 現在の状態確認
```bash
# アクティブ環境確認
docker service ls | grep server-
curl -s http://localhost/api/health | jq
```

#### 2. Green環境への新バージョンデプロイ
```bash
# Green環境にデプロイ
docker service update \
  --image safevideo/server:v1.2.3 \
  --replicas 3 \
  safevideo_server-green
```

#### 3. ヘルスチェック実行
```bash
# Green環境ヘルスチェック
for i in {1..30}; do
  if curl -s http://green-env/api/health | grep -q "ok"; then
    echo "Green environment is healthy"
    break
  fi
  sleep 10
done
```

#### 4. トラフィック切り替え
```bash
# Blue → Green切り替え
docker service scale safevideo_server-blue=0
docker service scale safevideo_server-green=3

# 切り替え確認
curl -s http://localhost/api/version
```

#### 5. Blue環境クリーンアップ
```bash
# 旧バージョンクリーンアップ（24時間後）
docker service scale safevideo_server-blue=0
docker image prune -f
```

## 📊 監視とアラート

### Grafanaダッシュボード
- **URL**: https://yourdomain.com/grafana
- **初期ログイン**: admin / （secrets/grafana_password.txtの内容）

#### 主要ダッシュボード
1. **SafeVideo Main**: アプリケーション全体概要
2. **Infrastructure**: システムリソース監視
3. **Security**: セキュリティメトリクス
4. **Business**: ビジネスKPI

### アラート設定
```yaml
# 重要アラート一覧
- サービスダウン: 1分以内
- 高エラー率: 5分間10%以上
- レスポンス遅延: 5分間2秒以上
- リソース使用率: CPU 80%、メモリ 85%
- セキュリティ: 不正ログイン試行
```

### ログ監視
```bash
# リアルタイムログ監視
./scripts/security-audit/incident-response.sh monitor

# アプリケーションログ
docker service logs -f safevideo_server-blue

# セキュリティログ
tail -f /var/log/auth.log | grep Failed
```

## 🔒 セキュリティチェックリスト

### デプロイ前チェック
- [ ] SSL証明書有効性確認
- [ ] 全シークレット設定完了
- [ ] ファイアウォール設定確認
- [ ] WAF設定有効化
- [ ] セキュリティヘッダー設定
- [ ] OWASP Top 10対策実装

### デプロイ後チェック
- [ ] 脆弱性スキャン実行
- [ ] ペネトレーションテスト
- [ ] セキュリティアラート動作確認
- [ ] ログ監視設定確認
- [ ] インシデント対応手順テスト

```bash
# 自動セキュリティスキャン
./scripts/security-audit/vulnerability-scanner.sh

# インシデント対応テスト
./scripts/security-audit/incident-response.sh health-check
```

## 🔧 トラブルシューティング

### よくある問題

#### 1. サービス起動失敗
```bash
# サービス状態確認
docker service ps safevideo_server-blue --no-trunc

# ログ確認
docker service logs safevideo_server-blue

# リソース確認
docker node ls
docker system df
```

#### 2. データベース接続エラー
```bash
# データベース状態確認
docker exec -it $(docker ps -q -f name=mysql-master) mysql -u root -p

# レプリケーション状態確認
docker exec -it $(docker ps -q -f name=mysql-master) \
  mysql -u root -p -e "SHOW MASTER STATUS;"
```

#### 3. 高負荷時の対応
```bash
# 自動スケーリング
docker service scale safevideo_server-blue=6

# リソース監視
docker stats
htop
```

### 緊急時ロールバック
```bash
# 即座ロールバック
docker service rollback safevideo_server-blue

# 手動ロールバック
docker service update --image safevideo/server:v1.1.9 safevideo_server-blue

# ヘルスチェック
curl -s http://localhost/api/health
```

## 📈 パフォーマンス最適化

### データベース最適化
```sql
-- インデックス最適化
ANALYZE TABLE users, documents, verifications;

-- パフォーマンススキーマ有効化
SET GLOBAL performance_schema = ON;

-- スロークエリログ
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;
```

### Redis最適化
```bash
# Redis設定確認
docker exec -it $(docker ps -q -f name=redis) redis-cli INFO memory

# キャッシュクリア
docker exec -it $(docker ps -q -f name=redis) redis-cli FLUSHDB
```

### アプリケーション最適化
```bash
# Node.jsメモリ使用量確認
docker exec -it $(docker ps -q -f name=server) node -e "console.log(process.memoryUsage())"

# ガベージコレクション最適化
export NODE_OPTIONS="--max-old-space-size=1024 --gc-global"
```

## 🔄 定期メンテナンス

### 日次タスク
```bash
#!/bin/bash
# daily-maintenance.sh

# ログローテーション
docker exec -it $(docker ps -q -f name=nginx) nginx -s reopen

# データベースバックアップ
docker exec $(docker ps -q -f name=mysql-master) \
  mysqldump -u root -p${MYSQL_ROOT_PASSWORD} --all-databases > backup_$(date +%Y%m%d).sql

# セキュリティスキャン
./scripts/security-audit/vulnerability-scanner.sh

# ヘルスチェック
./scripts/security-audit/incident-response.sh health-check
```

### 週次タスク
```bash
#!/bin/bash
# weekly-maintenance.sh

# イメージ更新チェック
docker image ls | grep safevideo

# 証明書有効期限チェック
openssl x509 -in /etc/ssl/certs/safevideo.crt -noout -enddate

# パフォーマンス分析
docker stats --no-stream > performance_$(date +%Y%m%d).log

# 容量チェック
df -h > disk_usage_$(date +%Y%m%d).log
```

### 月次タスク
```bash
#!/bin/bash
# monthly-maintenance.sh

# 依存関係更新
npm audit fix
docker pull --all-tags safevideo/base

# ログアーカイブ
tar -czf logs_$(date +%Y%m).tar.gz /var/log/safevideo/

# パフォーマンスレポート生成
./scripts/generate-performance-report.sh
```

## 📞 緊急時連絡先

### 内部チーム
| 役割 | 担当者 | 連絡先 | 対応時間 |
|-----|-------|-------|----------|
| DevOpsリード | DevOps Team | devops@safevideo.com | 24/7 |
| セキュリティリード | Security Team | security@safevideo.com | 24/7 |
| データベース管理者 | DBA Team | dba@safevideo.com | 営業時間 |
| アプリケーション開発 | Dev Team | dev@safevideo.com | 営業時間 |

### 外部パートナー
| サービス | プロバイダー | 連絡先 | 対応内容 |
|---------|-------------|-------|----------|
| インフラ | Cloud Provider | support@cloud.com | インフラ障害 |
| CDN | CDN Provider | support@cdn.com | CDN問題 |
| 監視 | Monitoring Service | alerts@monitoring.com | 監視アラート |
| セキュリティ | Security Vendor | incident@security.com | セキュリティ侵害 |

## 📋 デプロイメントチェックリスト

### Pre-deployment（デプロイ前）
- [ ] バックアップ完了確認
- [ ] 依存関係更新確認
- [ ] セキュリティスキャン完了
- [ ] ステージング環境テスト完了
- [ ] ロールバック手順確認
- [ ] チーム通知完了

### During deployment（デプロイ中）
- [ ] デプロイプロセス監視
- [ ] ヘルスチェック実行
- [ ] パフォーマンス監視
- [ ] エラーログ監視
- [ ] ユーザー影響確認

### Post-deployment（デプロイ後）
- [ ] 全機能動作確認
- [ ] パフォーマンステスト
- [ ] セキュリティチェック
- [ ] 監視アラート確認
- [ ] ユーザーフィードバック収集
- [ ] ドキュメント更新

---

**最終更新**: 2024-01-21  
**バージョン**: 3.0.0  
**承認者**: DevOpsチーム

このドキュメントは機密情報を含みます。適切に管理し、権限のない者と共有しないでください。