#!/bin/bash

# APIエンドポイント疎通確認スクリプト
# 実行方法: bash api-endpoint-test.sh

echo "================================================"
echo "SafeVideo API エンドポイント疎通確認"
echo "実行日時: $(date)"
echo "================================================"

# APIベースURL
API_BASE="https://api.sharegramvideo.org"

# 色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# テスト結果カウンター
PASS=0
FAIL=0

# テスト関数
test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local description=$4
    
    echo -n "Testing: $description... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$API_BASE$endpoint")
    
    if [ "$response" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Status: $response)"
        ((PASS++))
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $response)"
        ((FAIL++))
    fi
}

# SSL証明書確認
echo -e "\n${YELLOW}1. SSL証明書確認${NC}"
echo "----------------------------------------"
echo | openssl s_client -connect api.sharegramvideo.org:443 2>/dev/null | openssl x509 -noout -dates | grep -E "notBefore|notAfter"

# ヘルスチェック
echo -e "\n${YELLOW}2. ヘルスチェックエンドポイント${NC}"
echo "----------------------------------------"
test_endpoint "GET" "/health" 200 "Health Check"

# 認証関連エンドポイント
echo -e "\n${YELLOW}3. 認証関連エンドポイント${NC}"
echo "----------------------------------------"
test_endpoint "POST" "/api/auth/login" 400 "Login (without body - expect 400)"
test_endpoint "POST" "/api/auth/register" 400 "Register (without body - expect 400)"
test_endpoint "POST" "/api/auth/logout" 401 "Logout (without auth - expect 401)"

# 保護されたエンドポイント
echo -e "\n${YELLOW}4. 保護されたエンドポイント（認証なし）${NC}"
echo "----------------------------------------"
test_endpoint "GET" "/api/dashboard/stats" 401 "Dashboard Stats (expect 401)"
test_endpoint "GET" "/api/performers" 401 "Performers List (expect 401)"
test_endpoint "GET" "/api/audit-logs" 401 "Audit Logs (expect 401)"

# CORS プリフライトテスト
echo -e "\n${YELLOW}5. CORS設定確認${NC}"
echo "----------------------------------------"
echo -n "Testing: CORS Preflight... "
cors_response=$(curl -s -I -X OPTIONS "$API_BASE/api/auth/login" \
  -H "Origin: https://singular-winter-370002.web.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type")

if echo "$cors_response" | grep -q "Access-Control-Allow-Origin"; then
    echo -e "${GREEN}✓ PASS${NC} (CORS headers present)"
    ((PASS++))
else
    echo -e "${RED}✗ FAIL${NC} (CORS headers missing)"
    ((FAIL++))
fi

# WebSocket接続テスト
echo -e "\n${YELLOW}6. WebSocket接続テスト${NC}"
echo "----------------------------------------"
echo -n "Testing: WebSocket endpoint... "
ws_response=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Sec-WebSocket-Version: 13" \
  "$API_BASE/ws")

if [ "$ws_response" -eq "426" ] || [ "$ws_response" -eq "101" ]; then
    echo -e "${GREEN}✓ PASS${NC} (WebSocket endpoint responding)"
    ((PASS++))
else
    echo -e "${RED}✗ FAIL${NC} (WebSocket endpoint not responding properly)"
    ((FAIL++))
fi

# テスト結果サマリー
echo -e "\n================================================"
echo -e "${YELLOW}テスト結果サマリー${NC}"
echo "================================================"
echo -e "成功: ${GREEN}$PASS${NC}"
echo -e "失敗: ${RED}$FAIL${NC}"
echo -e "合計: $((PASS + FAIL))"

if [ $FAIL -eq 0 ]; then
    echo -e "\n${GREEN}すべてのテストが成功しました！${NC}"
    exit 0
else
    echo -e "\n${RED}一部のテストが失敗しました。${NC}"
    exit 1
fi