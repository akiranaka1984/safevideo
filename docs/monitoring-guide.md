# SafeVideo 監視・運用ガイド

## 1. 概要

本ドキュメントは、SafeVideoシステムの監視・ロギング・運用に関する包括的なガイドです。

### 監視スタック構成
- **メトリクス**: Prometheus + Grafana
- **ログ管理**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **アラート**: Prometheus Alertmanager
- **APM**: Application Performance Monitoring

## 2. クイックスタート

### 2.1 監視環境の起動

```bash
# 本番環境の起動（監視込み）
docker-compose -f docker-compose.prod.yml up -d

# ELKスタックの追加起動（オプション）
docker-compose -f monitoring/elk/docker-compose.elk.yml up -d
```

### 2.2 アクセスURL

| サービス | URL | デフォルト認証情報 |
|---------|-----|------------------|
| Grafana | http://localhost:3000 | admin / ${GRAFANA_PASSWORD} |
| Prometheus | http://localhost:9090 | 認証なし |
| Kibana | http://localhost:5601/kibana | elastic / ${ELASTIC_PASSWORD} |
| Alertmanager | http://localhost:9093 | 認証なし |

## 3. Grafanaダッシュボード

### 3.1 事前設定済みダッシュボード

1. **SafeVideo Overview**
   - リクエストレート
   - エラー率
   - レスポンスタイム（p95, p99）
   - システムリソース使用率

2. **Container Metrics**
   - コンテナ別CPU/メモリ使用率
   - コンテナ再起動回数
   - ネットワークI/O

3. **Database Performance**
   - クエリレート
   - スロークエリ
   - 接続プール使用率
   - レプリケーション遅延

4. **Business Metrics**
   - KYC申請数
   - 承認/却下率
   - 処理時間
   - アップロード成功率

### 3.2 カスタムダッシュボード作成

```sql
-- 例：直近1時間のKYC申請数
SELECT
  COUNT(*) as kyc_applications,
  DATE_FORMAT(created_at, '%Y-%m-%d %H:00:00') as hour
FROM performers
WHERE created_at >= NOW() - INTERVAL 1 HOUR
GROUP BY hour;
```

## 4. アラート設定

### 4.1 アラートレベル

| レベル | 説明 | 対応時間 | 通知先 |
|-------|------|---------|--------|
| Critical | サービス停止・データ損失リスク | 即時 | PagerDuty, Slack, Email |
| Warning | パフォーマンス劣化・リソース不足 | 1時間以内 | Slack, Email |
| Info | 通常の運用情報 | 営業時間内 | Email |

### 4.2 主要アラート

#### システムアラート
- **ContainerDown**: コンテナ停止（2分以上）
- **HighCPUUsage**: CPU使用率80%以上（5分間）
- **HighMemoryUsage**: メモリ使用率85%以上（5分間）
- **HighDiskUsage**: ディスク使用率80%以上

#### アプリケーションアラート
- **HighErrorRate**: エラー率5%以上
- **HighResponseTime**: p95レスポンスタイム2秒以上
- **HighLoginFailureRate**: ログイン失敗率30%以上

#### ビジネスアラート
- **KYCProcessingDelay**: KYC処理5分以上
- **HighUploadFailureRate**: アップロード失敗率10%以上

### 4.3 アラート設定例

```yaml
# Slackへの通知設定
receivers:
  - name: 'slack-notifications'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#safevideo-alerts'
        title: 'SafeVideo Alert'
        text: '{{ .GroupLabels.alertname }} - {{ .Annotations.summary }}'
```

## 5. ログ管理

### 5.1 ログレベル

| レベル | 用途 | 保存期間 |
|-------|------|---------|
| ERROR | エラー・例外 | 90日 |
| WARN | 警告・注意事項 | 30日 |
| INFO | 通常の操作ログ | 14日 |
| DEBUG | デバッグ情報 | 7日 |

### 5.2 構造化ログフォーマット

```json
{
  "timestamp": "2024-01-21T10:30:45.123Z",
  "level": "INFO",
  "service": "safevideo-api",
  "traceId": "abc123",
  "userId": "user123",
  "action": "login",
  "duration": 145,
  "status": "success",
  "metadata": {
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  }
}
```

### 5.3 ログ検索クエリ例

```
# Kibanaでのクエリ例

# 直近1時間のエラーログ
level:ERROR AND @timestamp:[now-1h TO now]

# 特定ユーザーの操作ログ
userId:"user123" AND action:*

# ログイン失敗
action:login AND status:failed

# レスポンスタイムが遅いAPI
duration:>1000 AND service:"safevideo-api"
```

## 6. パフォーマンス監視

### 6.1 主要メトリクス

#### ゴールデンシグナル
1. **レイテンシ**: レスポンスタイム
2. **トラフィック**: リクエスト/秒
3. **エラー**: エラー率
4. **飽和**: リソース使用率

### 6.2 SLI/SLO設定

```yaml
# Service Level Indicators
slis:
  - name: availability
    query: |
      sum(rate(http_requests_total{status!~"5.."}[5m])) /
      sum(rate(http_requests_total[5m]))
    
  - name: latency
    query: |
      histogram_quantile(0.95,
        sum(rate(http_request_duration_seconds_bucket[5m]))
        by (le)
      )

# Service Level Objectives
slos:
  - sli: availability
    target: 0.999  # 99.9%
    
  - sli: latency
    target: 0.5    # 500ms
```

## 7. トラブルシューティング

### 7.1 一般的な問題と対処法

#### 高いCPU使用率
```bash
# プロセス確認
docker exec safevideo-server top

# Node.jsのメモリ使用量確認
docker exec safevideo-server node -e "console.log(process.memoryUsage())"

# ヒープダンプ取得
docker exec safevideo-server kill -USR2 1
```

#### メモリリーク調査
```bash
# メモリ使用量の推移確認
docker stats --no-stream

# ヒープスナップショット取得
docker exec safevideo-server node --inspect=0.0.0.0:9229
```

#### データベース接続エラー
```sql
-- 接続数確認
SHOW PROCESSLIST;

-- スロークエリ確認
SELECT * FROM mysql.slow_log ORDER BY query_time DESC LIMIT 10;

-- ロック状況確認
SHOW ENGINE INNODB STATUS;
```

### 7.2 緊急時の対応

#### サービス再起動
```bash
# 特定コンテナの再起動
docker-compose -f docker-compose.prod.yml restart server

# 全サービスの再起動
docker-compose -f docker-compose.prod.yml restart

# 強制再作成
docker-compose -f docker-compose.prod.yml up -d --force-recreate
```

#### ログ収集
```bash
# 全ログの収集
docker-compose -f docker-compose.prod.yml logs > safevideo_logs_$(date +%Y%m%d_%H%M%S).log

# 特定サービスのログ
docker logs safevideo-server --tail 1000 > server_error.log
```

## 8. バックアップとリカバリ

### 8.1 自動バックアップ

```bash
#!/bin/bash
# backup.sh - 日次バックアップスクリプト

# データベースバックアップ
docker exec safevideo-mysql mysqldump \
  -u root -p${MYSQL_ROOT_PASSWORD} \
  --all-databases --single-transaction \
  > backup/mysql_$(date +%Y%m%d).sql

# アップロードファイルのバックアップ
tar -czf backup/uploads_$(date +%Y%m%d).tar.gz uploads/

# S3へのアップロード（オプション）
aws s3 cp backup/ s3://safevideo-backups/ --recursive
```

### 8.2 リカバリ手順

```bash
# データベースリストア
docker exec -i safevideo-mysql mysql \
  -u root -p${MYSQL_ROOT_PASSWORD} \
  < backup/mysql_20240121.sql

# ファイルリストア
tar -xzf backup/uploads_20240121.tar.gz -C ./
```

## 9. 監視のベストプラクティス

### 9.1 プロアクティブ監視
- トレンド分析による問題の事前検知
- キャパシティプランニング
- 定期的なパフォーマンステスト

### 9.2 インシデント管理
- オンコールローテーション
- ランブック（対応手順書）の整備
- ポストモーテムの実施

### 9.3 継続的改善
- メトリクスの定期レビュー
- アラートのチューニング
- 自動化の推進

## 10. セキュリティ監視

### 10.1 監視項目
- 不正アクセス試行
- 異常なトラフィックパターン
- 設定変更の追跡
- 脆弱性スキャン結果

### 10.2 セキュリティダッシュボード
- ログイン試行の可視化
- APIアクセスパターン
- エラー率の異常検知
- 地理的アクセス分布

## 11. 運用チェックリスト

### 日次
- [ ] ダッシュボード確認
- [ ] アラート確認・対応
- [ ] バックアップ実行確認
- [ ] ディスク使用率確認

### 週次
- [ ] パフォーマンストレンド分析
- [ ] ログローテーション確認
- [ ] セキュリティログレビュー
- [ ] アップデート確認

### 月次
- [ ] SLOレビュー
- [ ] キャパシティプランニング
- [ ] インシデント分析
- [ ] 監視設定の見直し

## 12. 連絡先

| 役割 | 担当 | 連絡先 |
|-----|------|--------|
| 監視リード | DevOps Team | monitoring@safevideo.com |
| オンコール | 当番制 | oncall@safevideo.com |
| エスカレーション | SRE Manager | sre-manager@safevideo.com |

---

最終更新: 2024-01-21
バージョン: 1.0.0