#!/usr/bin/env bash
# Prueba de integridad de la integración FR (reconocimiento facial).
# Uso: bash scripts/test-fr-integration.sh <ruta_foto.jpg> [base_proxy]
set -euo pipefail
IMG="${1:?Pasa una foto: bash scripts/test-fr-integration.sh foto.jpg}"
PROXY="${2:-http://localhost:3005}"
source .env.local 2>/dev/null || true
FR="${FR_API_URL:?FR_API_URL no definido}"; KEY="${FR_API_KEY:?FR_API_KEY no definido}"

echo "== 1) FR-API directo (/health) =="
curl -s -m 15 "$FR/health"; echo
echo "== 2) FR-API /v1/check-duplicate (con key) =="
curl -s -m 60 -H "X-API-Key: $KEY" -F "file=@$IMG" "$FR/v1/check-duplicate" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('  possible_duplicate:',d['possible_duplicate'],'| msg:',d['message']);[print('   -',c['person_name'],round(c['score'],2)) for c in d['candidates'][:3]]"
echo "== 3) Proxy de reportavnzla (/api/fr/check-duplicate) =="
curl -s -m 60 -F "file=@$IMG" "$PROXY/api/fr/check-duplicate" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print('  proxy ok:',d.get('ok'),'| possible_duplicate:',d.get('possible_duplicate'))" \
  || echo "  (¿reportavnzla corriendo en $PROXY?)"
