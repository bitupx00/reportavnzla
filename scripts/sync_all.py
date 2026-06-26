#!/usr/bin/env python3
"""
ReportaVNZLA — Unified Sync Script
===================================
Single script that handles ALL data sources:
1. DTV (desaparecidosterremotovenezuela.com) — 54K records
2. VTB (venezuela-te-busca-app) — ~19K records  
3. TVE (terremotovenezuela.app) — ~18K records
4. SOS (sosvenezuela2026.com) — ~58K records

Features:
- Full name split (nombre + apellido)
- Estado mapping: localizado → encontrado, found → encontrado
- Dedup by external_id (skips known duplicates)
- Post-sync dedup by normalized full name
- Rate limit respect for all APIs
"""

import requests, json, time, sys, re
from collections import defaultdict

API_BASE = "https://reportavnzla.com/api/v1/personas"
DEDUP_URL = "https://reportavnzla.com/api/v1/dedup2"
STATS_URL = "https://reportavnzla.com/api/v1/stats-fuentes"
DEDUP_SECRET = "DEDUP_VNZLA_2026"

# ── Source APIs ──
DTV_API = "https://desaparecidos-terremoto-api.theempire.tech/api/personas"
VTB_API = "https://venezuela-te-busca-app.hellogafaro.workers.dev/api/persons"
TVE_API = "https://terremotovenezuela.app/api/v1/persons"
SOS_API = "https://sosvenezuela2026.com/api/persons/list"

BATCH_SIZE = 50
SYNC_HEADERS = {
    "x-sync-secret": "DEDUP_VNZLA_2026",
}

BATCH_SIZE = 50
STATS_CACHE = defaultdict(lambda: {"imported": 0, "skipped": 0, "updated": 0, "errors": 0, "found_count": 0})

def log(source, msg):
    print(f"[{source}] {msg}", flush=True)

def split_name(full):
    """Split full display name into nombre + apellido"""
    if not full:
        return "", ""
    parts = str(full).strip().split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0].title(), ""
    return " ".join(parts[:-1]).title(), parts[-1].title()

def import_batch(personas, source):
    """Import a batch to the API"""
    if not personas:
        return
    for i in range(0, len(personas), BATCH_SIZE):
        batch = personas[i:i+BATCH_SIZE]
        try:
            r = requests.post(API_BASE, json=batch, headers=SYNC_HEADERS, timeout=60)
            if r.status_code == 429:
                log(source, "⚠️ 429 — esperando 15s...")
                time.sleep(15)
                r = requests.post(API_BASE, json=batch, headers=SYNC_HEADERS, timeout=60)
            result = r.json()
            STATS_CACHE[source]["imported"] += result.get("imported", 0)
            STATS_CACHE[source]["skipped"] += result.get("skipped", 0)
            STATS_CACHE[source]["updated"] += result.get("updated", 0)
            STATS_CACHE[source]["errors"] += result.get("errors", 0)
        except Exception as e:
            STATS_CACHE[source]["errors"] += len(batch)
            log(source, f"❌ Import error: {e}")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SOURCE 1: DTV (desaparecidosterremotovenezuela.com)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def sync_dtv(start_page=1):
    log("DTV", f"🔄 Iniciando sync completo... (desde página {start_page})")
    page = start_page
    consecutive_429 = 0
    while True:
        try:
            resp = requests.get(f"{DTV_API}?page={page}&pageSize=100", timeout=15)
            if resp.status_code == 429:
                consecutive_429 += 1
                wait = min(30 * consecutive_429, 180)
                log("DTV", f"⚠️ 429 — esperando {wait}s (intentos: {consecutive_429})...")
                time.sleep(wait)
                continue
            consecutive_429 = 0
            if resp.status_code != 200:
                log("DTV", f"❌ HTTP {resp.status_code}")
                break
            data = resp.json()
        except Exception as e:
            log("DTV", f"❌ Error: {e}")
            time.sleep(5)
            continue
        
        items = data.get("items", [])
        if not items:
            break
        
        personas = []
        for r in items:
            nombre = (r.get("nombre") or "").strip()
            if not nombre or len(nombre) < 2:
                continue
            n, a = split_name(nombre)
            estado = "encontrado" if str(r.get("estado", "")).lower() == "localizado" else "buscado"
            if estado == "encontrado":
                STATS_CACHE["DTV"]["found_count"] += 1
            
            personas.append({
                "external_id": f"dtv-{r['id']}",
                "nombre": n,
                "apellido": a or "Desconocido",
                "edad": r.get("edad") or None,
                "estado": estado,
                "foto_url": r.get("foto") or None,
                "ultima_ubicacion": r.get("ubicacion") or None,
                "descripcion": r.get("descripcion") or None,
            })
        
        import_batch(personas, "DTV")
        total_pages = data.get("totalPages", "?")
        if page % 10 == 0 or page == 1:
            s = STATS_CACHE["DTV"]
            log("DTV", f"Page {page}/{total_pages} — new:{s['imported']} upd:{s['updated']} dup:{s['skipped']} found:{s['found_count']}")
        
        page += 1
        if page > data.get("totalPages", 9999):
            break
        time.sleep(1.5)
    
    s = STATS_CACHE["DTV"]
    log("DTV", f"✅ Done — new:{s['imported']} upd:{s['updated']} dup:{s['skipped']} err:{s['errors']} found:{s['found_count']}")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SOURCE 2: VTB (venezuela-te-busca-app)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def sync_vtb():
    log("VTB", "🔄 Iniciando sync completo...")
    cursor = None
    page = 0
    while True:
        url = f"{VTB_API}?limit=250"
        if cursor:
            url += f"&cursor={cursor}"
        try:
            resp = requests.get(url, timeout=15)
            if resp.status_code != 200:
                log("VTB", f"❌ HTTP {resp.status_code}")
                break
            data = resp.json()
        except Exception as e:
            log("VTB", f"❌ Error: {e}")
            break
        
        items = data.get("persons", [])
        if not items:
            break
        
        personas = []
        for r in items:
            nombre = (r.get("first_name") or "").strip()
            apellido = (r.get("last_name") or "").strip()
            if not nombre or len(nombre) < 2:
                continue
            estado = "encontrado" if str(r.get("status", "")).lower() == "found" else "buscado"
            if estado == "encontrado":
                STATS_CACHE["VTB"]["found_count"] += 1
            
            personas.append({
                "external_id": f"vtb-{r['id']}",
                "nombre": nombre[:100].title(),
                "apellido": (apellido[:100].title()) or "Desconocido",
                "cedula": r.get("national_id") or None,
                "edad": r.get("age") or None,
                "estado": estado,
                "foto_url": r.get("photo_key", "") and f"https://venezuela-te-busca-app.hellogafaro.workers.dev{r['photo_key']}" or None,
                "ultima_ubicacion": r.get("last_seen_location") or None,
                "descripcion": r.get("description") or None,
            })
        
        import_batch(personas, "VTB")
        cursor = items[-1].get("created_at")
        page += 1
        if page % 10 == 0 or len(items) < 250:
            s = STATS_CACHE["VTB"]
            log("VTB", f"Batch {page} — new:{s['imported']} dup:{s['skipped']} found:{s['found_count']}")
        
        if len(items) < 250:
            break
        time.sleep(0.5)
    
    s = STATS_CACHE["VTB"]
    log("VTB", f"✅ Done — new:{s['imported']} dup:{s['skipped']} err:{s['errors']} found:{s['found_count']}")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SOURCE 3: TVE (terremotovenezuela.app)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def sync_tve():
    log("TVE", "🔄 Iniciando sync completo...")
    page = 1
    while True:
        try:
            resp = requests.get(f"{TVE_API}?page={page}&limit=100", timeout=15)
            if resp.status_code != 200:
                log("TVE", f"❌ HTTP {resp.status_code}")
                break
            data = resp.json()
        except Exception as e:
            log("TVE", f"❌ Error: {e}")
            break
        
        items = data.get("data", data.get("persons", []))
        if isinstance(data, list):
            items = data
        if not items:
            break
        
        personas = []
        for r in items:
            nombre = (r.get("name") or "").strip()
            if not nombre or len(nombre) < 2:
                continue
            n, a = split_name(nombre)
            status = str(r.get("status", "") or r.get("_tve_status", "")).lower()
            estado = "encontrado" if status == "found" else "buscado"
            if estado == "encontrado":
                STATS_CACHE["TVE"]["found_count"] += 1
            
            personas.append({
                "external_id": f"tve-{r.get('id', r.get('_id', ''))}",
                "nombre": n,
                "apellido": a or "Desconocido",
                "cedula": r.get("ciPassport") or None,
                "edad": r.get("age") or None,
                "estado": estado,
                "foto_url": r.get("photoUrl") or None,
                "ultima_ubicacion": r.get("location") or None,
                "descripcion": r.get("description") or None,
            })
        
        import_batch(personas, "TVE")
        page += 1
        if page % 50 == 0 or page == 1:
            s = STATS_CACHE["TVE"]
            log("TVE", f"Page {page} — new:{s['imported']} dup:{s['skipped']} found:{s['found_count']}")
        
        if len(items) < 100:
            break
        time.sleep(0.3)
    
    s = STATS_CACHE["TVE"]
    log("TVE", f"✅ Done — new:{s['imported']} dup:{s['skipped']} err:{s['errors']} found:{s['found_count']}")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SOURCE 4: SOS Venezuela (sosvenezuela2026.com)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def sync_sos():
    log("SOS", "🔄 Iniciando sync (respetando rate limits)...")
    offset = 0
    consecutive_429 = 0
    
    while True:
        try:
            resp = requests.get(f"{SOS_API}?offset={offset}&limit=100", timeout=15)
            if resp.status_code == 429:
                consecutive_429 += 1
                if consecutive_429 > 10:
                    log("SOS", "⚠️ Rate limit persistente — parando. Continuará en próxima ejecución.")
                    break
                wait = min(60 * consecutive_429, 300)
                log("DTV", f"⚠️ 429 — esperando {wait}s (intentos: {consecutive_429})...")
                time.sleep(wait)
                continue
            consecutive_429 = 0
            if resp.status_code != 200:
                log("SOS", f"❌ HTTP {resp.status_code}")
                break
            data = resp.json()
        except Exception as e:
            log("SOS", f"❌ Error: {e} — esperando 10s...")
            time.sleep(10)
            continue
        
        if not data:
            log("SOS", f"[{offset}] No more data")
            break
        if not isinstance(data, list):
            log("SOS", f"[{offset}] Unexpected format: {type(data).__name__}")
            break
        
        personas = []
        for p in data:
            if not isinstance(p, dict):
                continue
            nombre = (p.get("display_name", "") or "").strip()
            if not nombre or len(nombre) < 2:
                continue
            n, a = split_name(nombre)
            status = str(p.get("status", "missing")).lower()
            estado = "encontrado" if status in ("found", "found_alive", "encontrado", "localizado", "rescatado") else "buscado"
            if estado == "encontrado":
                STATS_CACHE["SOS"]["found_count"] += 1
            
            parroquia = p.get("parroquia", "")
            municipio = p.get("municipio", "")
            estado_region = p.get("estado", "")
            ubicacion = ", ".join(filter(None, [parroquia, municipio, estado_region]))
            
            personas.append({
                "external_id": f"sos-{p.get('id', '')}",
                "nombre": n,
                "apellido": a or "Desconocido",
                "edad": p.get("age") or None,
                "estado": estado,
                "foto_url": p.get("photo_path") or None,
                "ultima_ubicacion": ubicacion or None,
                "descripcion": p.get("description") or None,
            })
        
        import_batch(personas, "SOS")
        if offset % 2000 == 0:
            s = STATS_CACHE["SOS"]
            log("SOS", f"[{offset}] new:{s['imported']} dup:{s['skipped']} found:{s['found_count']}")
        
        offset += 100
        time.sleep(2.0)  # Respect rate limit
    
    s = STATS_CACHE["SOS"]
    log("SOS", f"✅ Done — new:{s['imported']} dup:{s['skipped']} err:{s['errors']} found:{s['found_count']}")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DEDUP: Ultimate (full name normalized)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def run_dedup():
    log("DEDUP", "🔍 Ejecutando dedup ultimate (full name normalized)...")
    try:
        # Dry run first
        r = requests.get(f"{DEDUP_URL}?mode=ultimate", timeout=120)
        data = r.json()
        if not data.get("success"):
            log("DEDUP", f"❌ Error: {data.get('error')}")
            return
        
        groups = data.get("duplicate_groups", 0)
        removable = data.get("duplicates_would_remove", 0)
        log("DEDUP", f"  Grupos: {groups}, Removibles: {removable}")
        
        if groups and removable:
            r = requests.post(DEDUP_URL, json={"secret": DEDUP_SECRET}, timeout=300)
            result = r.json()
            if result.get("success"):
                deleted = result.get("deleted_count", 0)
                log("DEDUP", f"  ✅ Eliminados: {deleted}")
            else:
                log("DEDUP", f"  ❌ Error: {result.get('error')}")
        else:
            log("DEDUP", "  ✅ Sin duplicados — DB limpia")
    except Exception as e:
        log("DEDUP", f"❌ Error: {e}")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STATS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def print_stats():
    log("STATS", f"\n{'='*60}")
    log("STATS", "RESUMEN FINAL")
    log("STATS", f"{'='*60}")
    total_new = 0
    total_skip = 0
    total_err = 0
    total_found = 0
    for src in ["DTV", "VTB", "TVE", "SOS"]:
        s = STATS_CACHE[src]
        total_new += s["imported"]
        total_skip += s["skipped"]
        total_err += s["errors"]
        total_found += s["found_count"]
        log("STATS", f"  {src:5s}: +{s['imported']:6d} nuevos, {s['skipped']:6d} dup, {s['errors']:3d} err, {s['found_count']:5d} encontrados")
    
    log("STATS", f"  {'TOTAL':5s}: +{total_new:6d} nuevos, {total_skip:6d} dup, {total_err:3d} err, {total_found:5d} encontrados")
    
    try:
        r = requests.get(STATS_URL, timeout=15)
        data = r.json()
        if data.get("success"):
            log("STATS", f"\n📊 DB Final:")
            log("STATS", f"  Total: {data['total']}")
            for r2 in data["byEstado"]:
                log("STATS", f"  {r2['estado']}: {r2['cnt']}")
            for r2 in data["bySource"]:
                log("STATS", f"  {r2['fuente']}/{r2['estado']}: {r2['cnt']}")
    except:
        pass

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MAIN
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
def main():
    sources = sys.argv[1:] if len(sys.argv) > 1 else ["dtv", "vtb", "tve", "sos"]
    
    log("SYNC", f"🚀 ReportaVNZLA Unified Sync — fuentes: {sources}")
    log("SYNC", f"   Hora: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    for src in sources:
        fn = {
            "dtv": lambda: sync_dtv(start_page=130),
            "vtb": sync_vtb,
            "tve": sync_tve,
            "sos": sync_sos,
        }.get(src)
        if fn:
            log("SYNC", f"\n{'━'*60}")
            fn()
            log("SYNC", f"{'━'*60}")
        else:
            log("SYNC", f"❌ Fuente desconocida: {src}")
    
    # Dedup after all imports
    log("SYNC", "\n🧹 Dedup post-import...")
    run_dedup()
    
    # Final stats
    print_stats()
    
    log("SYNC", "✅ Sync completado")

if __name__ == "__main__":
    main()
