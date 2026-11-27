#!/bin/bash
# 배포 전에 실행: index.html 의 로컬 모듈 import 버전 쿼리(?v=...)를 올려 브라우저 캐시에 남은 옛 파일을 쓰지 않게 한다.
# 사용법: scripts/bump-version.sh [버전]   (생략하면 현재 시각 yyyymmddHHMMSS)
set -euo pipefail
cd "$(dirname "$0")/.."
VER="${1:-$(date +%Y%m%d%H%M%S)}"
[[ "$VER" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "버전에는 영문/숫자/._- 만 쓸 수 있습니다: $VER" >&2; exit 1; }
perl -pi -e "s{(from '\./(?:roster|sim)\.js)\?v=[A-Za-z0-9._-]+'}{\$1?v=$VER'}g" index.html
echo "버전을 $VER 로 갱신했습니다:"
grep -n "from '\./\(roster\|sim\)\.js" index.html | cut -c1-60
