#!/usr/bin/env python3
"""
fr-doctor — valida tu configuración del FR-API (reconocimiento facial) en local.

Uso:
    python fr-doctor.py            # lee el .env del directorio actual
    python fr-doctor.py /ruta/.env

Sin dependencias (solo librería estándar). Te dice en 5 segundos qué está mal:
key truncada (401), source que no coincide con tu key, o 0 registros indexados.
"""
import json
import os
import sys
import urllib.error
import urllib.request


def load_env(path=".env"):
    env = dict(os.environ)
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            s = line.strip()
            if not s or s.startswith("#") or "=" not in s:
                continue
            k, v = s.split("=", 1)
            env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    return env


def http(url, key=None, timeout=15):
    req = urllib.request.Request(url)
    if key:
        req.add_header("X-API-Key", key)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}
    except Exception as e:
        return None, {"error": str(e)}


def end(fails):
    print("=" * 44)
    print("✅ Todo listo." if fails == 0 else f"❌ {fails} problema(s) crítico(s). Arregla y reejecuta.")
    sys.exit(0 if fails == 0 else 1)


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else ".env"
    env = load_env(path)
    url = (env.get("FR_API_URL") or "https://fr-api.reportavnzla.com:8443").strip().rstrip("/")
    key = (env.get("FR_API_KEY") or "").strip()
    source = (env.get("FR_SOURCE") or "").strip()
    minsc = (env.get("FR_MIN_SCORE") or "").strip()
    fails = 0

    print("FR-DOCTOR — diagnóstico del FR-API")
    print("=" * 44)
    print(f"FR_API_URL = {url}")

    # 1) Conectividad
    st, body = http(f"{url}/health")
    if st == 200:
        print(f" [OK]   servicio alcanzable (indexados global = {body.get('indexed')})")
    else:
        print(f" [FAIL] no se pudo conectar a {url} (status={st}) {body.get('error', '')}")
        return end(fails + 1)

    # 2) Longitud de la key
    if not key:
        print(" [FAIL] FR_API_KEY ausente en tu .env"); fails += 1
    elif len(key) != 48:
        print(f" [WARN] FR_API_KEY tiene {len(key)} caracteres; las válidas son 48 (¿truncada al copiar?)")
    else:
        print(" [OK]   FR_API_KEY tiene 48 caracteres")

    # 3) Auth + identidad (whoami)
    st, who = http(f"{url}/v1/whoami", key)
    if st == 401:
        print(" [FAIL] la API key NO autentica (401). Cópiala COMPLETA (48 caracteres) y reejecuta.")
        return end(fails + 1)
    if st != 200:
        print(f" [FAIL] /v1/whoami devolvió status={st} {who}")
        return end(fails + 1)
    label = who.get("source_default")
    print(f" [OK]   key válida — tu source_default = '{label}'")

    # 4) FR_SOURCE coincide con la etiqueta de la key
    if source and source != label:
        print(f" [WARN] FR_SOURCE='{source}' ≠ la etiqueta de tu key='{label}'. Deben ser IDÉNTICOS, "
              f"o /v1/duplicates no encontrará lo que indexes. Corrige FR_SOURCE='{label}'.")
    elif not source:
        print(f" [INFO] FR_SOURCE no está en tu .env; por defecto usarás '{label}'.")
    else:
        print(f" [OK]   FR_SOURCE coincide con tu key ('{label}')")

    # 5) ¿Tienes datos indexados?
    mine = who.get("indexed_my_source", 0)
    if not mine:
        print(f" [WARN] 0 registros indexados bajo '{label}'. El FR-API NO consulta tu base de datos: "
              f"debes hacer backfill con POST /v1/index. Sin índice, check-duplicate SIEMPRE dará "
              f"possible_duplicate=false.")
    else:
        print(f" [OK]   tienes {mine} registros indexados bajo '{label}'")

    # 6) FR_MIN_SCORE
    if minsc:
        print(f" [INFO] FR_MIN_SCORE='{minsc}' en tu .env NO tiene efecto por sí solo. El piso del "
              f"servidor es {who.get('min_score_default')}. Para cambiarlo, tu backend debe pasar "
              f"?min_score= en la petición (no basta el .env).")

    end(fails)


if __name__ == "__main__":
    main()
