import pandas as pd
import json
import numpy as np
import warnings
warnings.filterwarnings('ignore')

BASE = "/Users/razielbustodomaniczky/Library/Mobile Documents/com~apple~CloudDocs/Programacion/Segundo cerebro/Argentina"

# ========================================
# 1. MONTHLY RESUMEN from File 2 (grand totals row 926)
# ========================================
print("Processing File 2: Ordenes por Droshipper y proveedor...")
df2 = pd.read_excel(f"{BASE}/Ordenes por Droshipper y proveedor q1.xlsx", header=None)

# Find the grand total row (last row with "Total" or the actual totals)
# Row 926 in the file = index ~924 in 0-based after header
# Let's find it by looking for the last row with high numbers
last_rows = df2.tail(10)
print("Last 10 rows:")
print(last_rows.to_string())

# The header is at row 1-2. Let's read with header
df2h = pd.read_excel(f"{BASE}/Ordenes por Droshipper y proveedor q1.xlsx", header=[0,1])
print("\nColumns:", list(df2h.columns))

# Read raw to find grand total
# Based on analysis: row index ~924 (0-based from data start at row 2)
# Columns: A=provider, B=email/dropshipper
# Enero: C=Ing, D=Mov, E=%Mov, F=Ent, G=%Ent, H=Dev, I=%Dev
# Febrero: J=Ing, K=Mov, L=%Mov, M=Ent, N=%Ent, O=Dev, P=%Dev
# Marzo: Q=Ing, R=Mov, S=%Mov, T=Ent, U=%Ent, V=Dev, W=%Dev

# Find the grand total - search for max row
for idx in range(len(df2)-1, max(len(df2)-10, 0), -1):
    row = df2.iloc[idx]
    if pd.notna(row.iloc[2]) and isinstance(row.iloc[2], (int, float)) and row.iloc[2] > 5000:
        print(f"\nGrand total row at index {idx}:")
        print(row.values)
        gt = row
        break

ene_ing = int(gt.iloc[2])
ene_mov = int(gt.iloc[3])
ene_ent = int(gt.iloc[5])
ene_dev = int(gt.iloc[7])
feb_ing = int(gt.iloc[9])
feb_mov = int(gt.iloc[10])
feb_ent = int(gt.iloc[12])
feb_dev = int(gt.iloc[14])
mar_ing = int(gt.iloc[16])
mar_mov = int(gt.iloc[17])
mar_ent = int(gt.iloc[19])
mar_dev = int(gt.iloc[21])

print(f"\nResumen:")
print(f"Enero: Ing={ene_ing}, Mov={ene_mov}, Ent={ene_ent}, Dev={ene_dev}")
print(f"Febrero: Ing={feb_ing}, Mov={feb_mov}, Ent={feb_ent}, Dev={feb_dev}")
print(f"Marzo: Ing={mar_ing}, Mov={mar_mov}, Ent={mar_ent}, Dev={mar_dev}")

resumen = {
    "enero": {"ingresadas": ene_ing, "movilizadas": ene_mov, "entregados": ene_ent, "devoluciones": ene_dev},
    "febrero": {"ingresadas": feb_ing, "movilizadas": feb_mov, "entregados": feb_ent, "devoluciones": feb_dev},
    "marzo": {"ingresadas": mar_ing, "movilizadas": mar_mov, "entregados": mar_ent, "devoluciones": mar_dev},
}

# ========================================
# 2. PROVIDERS with monthly breakdown from File 2
# ========================================
print("\n\nProcessing providers from File 2...")

# Parse File 2 to extract provider totals
# Structure: grouped by provider, each has a "Total" row, then individual DS rows
providers = {}
current_provider = None

for idx in range(2, len(df2)-1):  # skip header rows
    row = df2.iloc[idx]
    col_a = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ""
    col_b = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ""

    # Provider name is in col A when it's not empty and not a number
    if col_a and col_a != "nan" and not col_a.replace('.','').isdigit():
        if "Total" in col_b or "total" in col_b:
            # This is a provider total row
            prov_name = col_a.replace(" Total", "").replace(" total", "").strip()
            try:
                p_data = {
                    "proveedor": prov_name,
                    "enero": {
                        "ing": int(row.iloc[2]) if pd.notna(row.iloc[2]) else 0,
                        "mov": int(row.iloc[3]) if pd.notna(row.iloc[3]) else 0,
                        "ent": int(row.iloc[5]) if pd.notna(row.iloc[5]) else 0,
                        "dev": int(row.iloc[7]) if pd.notna(row.iloc[7]) else 0,
                    },
                    "febrero": {
                        "ing": int(row.iloc[9]) if pd.notna(row.iloc[9]) else 0,
                        "mov": int(row.iloc[10]) if pd.notna(row.iloc[10]) else 0,
                        "ent": int(row.iloc[12]) if pd.notna(row.iloc[12]) else 0,
                        "dev": int(row.iloc[14]) if pd.notna(row.iloc[14]) else 0,
                    },
                    "marzo": {
                        "ing": int(row.iloc[16]) if pd.notna(row.iloc[16]) else 0,
                        "mov": int(row.iloc[17]) if pd.notna(row.iloc[17]) else 0,
                        "ent": int(row.iloc[19]) if pd.notna(row.iloc[19]) else 0,
                        "dev": int(row.iloc[21]) if pd.notna(row.iloc[21]) else 0,
                    },
                }
                providers[prov_name] = p_data
            except (ValueError, TypeError) as e:
                print(f"  Skipping provider {prov_name}: {e}")

print(f"Found {len(providers)} providers")

# Build provider list with totals and growth
proveedores_list = []
for name, p in providers.items():
    total_ing = p["enero"]["ing"] + p["febrero"]["ing"] + p["marzo"]["ing"]
    total_mov = p["enero"]["mov"] + p["febrero"]["mov"] + p["marzo"]["mov"]
    total_ent = p["enero"]["ent"] + p["febrero"]["ent"] + p["marzo"]["ent"]
    total_dev = p["enero"]["dev"] + p["febrero"]["dev"] + p["marzo"]["dev"]

    # Growth: marzo vs enero
    growth = None
    if p["enero"]["mov"] > 0 and p["marzo"]["mov"] > 0:
        growth = round(((p["marzo"]["mov"] - p["enero"]["mov"]) / p["enero"]["mov"]) * 100)

    # Count dropshippers per provider (will do below)
    pct_ent_ene = round(p["enero"]["ent"] / p["enero"]["mov"], 4) if p["enero"]["mov"] > 0 else None
    pct_dev_ene = round(p["enero"]["dev"] / p["enero"]["mov"], 4) if p["enero"]["mov"] > 0 else None
    pct_ent_feb = round(p["febrero"]["ent"] / p["febrero"]["mov"], 4) if p["febrero"]["mov"] > 0 else None
    pct_dev_feb = round(p["febrero"]["dev"] / p["febrero"]["mov"], 4) if p["febrero"]["mov"] > 0 else None
    pct_ent_mar = round(p["marzo"]["ent"] / p["marzo"]["mov"], 4) if p["marzo"]["mov"] > 0 else None
    pct_dev_mar = round(p["marzo"]["dev"] / p["marzo"]["mov"], 4) if p["marzo"]["mov"] > 0 else None

    proveedores_list.append({
        "proveedor": name,
        "sellers": 0,  # will fill from dropshipper count
        "enero": {"ing": p["enero"]["ing"], "mov": p["enero"]["mov"], "ent": p["enero"]["ent"], "dev": p["enero"]["dev"], "pct_entrega": pct_ent_ene, "pct_dev": pct_dev_ene},
        "febrero": {"ing": p["febrero"]["ing"], "mov": p["febrero"]["mov"], "ent": p["febrero"]["ent"], "dev": p["febrero"]["dev"], "pct_entrega": pct_ent_feb, "pct_dev": pct_dev_feb},
        "marzo": {"ing": p["marzo"]["ing"], "mov": p["marzo"]["mov"], "ent": p["marzo"]["ent"], "dev": p["marzo"]["dev"], "pct_entrega": pct_ent_mar, "pct_dev": pct_dev_mar},
        "total": {"ing": total_ing, "mov": total_mov, "ent": total_ent, "dev": total_dev},
        "growth_pct": growth,
    })

proveedores_list.sort(key=lambda x: x["total"]["mov"], reverse=True)

# ========================================
# 3. DROPSHIPPERS from File 2
# ========================================
print("\nProcessing dropshippers from File 2...")

dropshippers = {}
current_prov = None

for idx in range(2, len(df2)-1):
    row = df2.iloc[idx]
    col_a = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ""
    col_b = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ""

    # Track current provider
    if col_a and col_a != "nan" and not col_a.replace('.','').isdigit():
        prov_name = col_a.replace(" Total", "").replace(" total", "").strip()
        if "Total" in col_b or "total" in col_b:
            continue  # Skip total rows
        current_prov = prov_name

    # Dropshipper row: col_b has email (contains @)
    if "@" in col_b and col_b != "nan":
        email = col_b.strip()
        if email not in dropshippers:
            dropshippers[email] = {
                "email": email,
                "proveedores": [],
                "ene": {"ing": 0, "mov": 0},
                "feb": {"ing": 0, "mov": 0},
                "mar": {"ing": 0, "mov": 0},
                "total": {"ing": 0, "mov": 0, "ent": 0, "dev": 0},
            }

        if current_prov and current_prov not in dropshippers[email]["proveedores"]:
            dropshippers[email]["proveedores"].append(current_prov)

        try:
            e_ing = int(row.iloc[2]) if pd.notna(row.iloc[2]) else 0
            e_mov = int(row.iloc[3]) if pd.notna(row.iloc[3]) else 0
            e_ent = int(row.iloc[5]) if pd.notna(row.iloc[5]) else 0
            e_dev = int(row.iloc[7]) if pd.notna(row.iloc[7]) else 0
            f_ing = int(row.iloc[9]) if pd.notna(row.iloc[9]) else 0
            f_mov = int(row.iloc[10]) if pd.notna(row.iloc[10]) else 0
            f_ent = int(row.iloc[12]) if pd.notna(row.iloc[12]) else 0
            f_dev = int(row.iloc[14]) if pd.notna(row.iloc[14]) else 0
            m_ing = int(row.iloc[16]) if pd.notna(row.iloc[16]) else 0
            m_mov = int(row.iloc[17]) if pd.notna(row.iloc[17]) else 0
            m_ent = int(row.iloc[19]) if pd.notna(row.iloc[19]) else 0
            m_dev = int(row.iloc[21]) if pd.notna(row.iloc[21]) else 0

            dropshippers[email]["ene"]["ing"] += e_ing
            dropshippers[email]["ene"]["mov"] += e_mov
            dropshippers[email]["feb"]["ing"] += f_ing
            dropshippers[email]["feb"]["mov"] += f_mov
            dropshippers[email]["mar"]["ing"] += m_ing
            dropshippers[email]["mar"]["mov"] += m_mov
            dropshippers[email]["total"]["ing"] += e_ing + f_ing + m_ing
            dropshippers[email]["total"]["mov"] += e_mov + f_mov + m_mov
            dropshippers[email]["total"]["ent"] += e_ent + f_ent + m_ent
            dropshippers[email]["total"]["dev"] += e_dev + f_dev + m_dev
        except (ValueError, TypeError):
            pass

# Count sellers per provider
prov_sellers = {}
for email, ds in dropshippers.items():
    for prov in ds["proveedores"]:
        prov_sellers[prov] = prov_sellers.get(prov, 0) + 1

for p in proveedores_list:
    p["sellers"] = prov_sellers.get(p["proveedor"], 0)

# Build dropshipper list
ds_list = []
for email, d in dropshippers.items():
    if d["total"]["mov"] <= 0:
        continue
    pct_ent = round((d["total"]["ent"] / d["total"]["mov"]) * 100) if d["total"]["mov"] > 0 else 0
    pct_dev = round((d["total"]["dev"] / d["total"]["mov"]) * 100) if d["total"]["mov"] > 0 else 0
    pct_mov = round((d["total"]["mov"] / d["total"]["ing"]) * 100) if d["total"]["ing"] > 0 else 0

    growth = None
    if d["ene"]["mov"] > 0 and d["mar"]["mov"] > 0:
        growth = round(((d["mar"]["mov"] - d["ene"]["mov"]) / d["ene"]["mov"]) * 100)

    ds_list.append({
        "email": email,
        "proveedores": d["proveedores"],
        "num_proveedores": len(d["proveedores"]),
        "ene": d["ene"],
        "feb": d["feb"],
        "mar": d["mar"],
        "total": d["total"],
        "pct_ent": pct_ent,
        "pct_dev": pct_dev,
        "pct_mov": pct_mov,
        "growth": growth,
    })

ds_list.sort(key=lambda x: x["total"]["mov"], reverse=True)
print(f"Found {len(ds_list)} active dropshippers")

# ========================================
# 4. TOP SELLERS for sellers table
# ========================================
sellers_top = []
for d in ds_list[:150]:
    total_mov = d["total"]["mov"]
    pct_entrega = round(d["total"]["ent"] / total_mov, 4) if total_mov > 0 else None
    pct_dev_val = round(d["total"]["dev"] / total_mov, 4) if total_mov > 0 else None

    sellers_top.append({
        "email": d["email"],
        "enero": {"mov": d["ene"]["mov"], "pct_entrega": None, "pct_dev": None},
        "febrero": {"mov": d["feb"]["mov"], "pct_entrega": None, "pct_dev": None},
        "marzo": {"mov": d["mar"]["mov"], "pct_entrega": None, "pct_dev": None},
        "total": {"mov": total_mov, "pct_entrega": pct_entrega, "pct_dev": pct_dev_val},
    })

# ========================================
# 5. PRODUCTS from File 4
# ========================================
print("\nProcessing products from File 4...")
df_prod = pd.read_excel(f"{BASE}/Productos mas vendidos q1 2026.xlsx")
print(f"Product columns: {list(df_prod.columns)}")
print(df_prod.head())

# Clean
df_prod = df_prod.dropna(subset=[df_prod.columns[0], df_prod.columns[1]])
df_prod.columns = ["producto", "cantidad"]
# Remove total row
df_prod = df_prod[~df_prod["producto"].str.contains("Total|total", na=False)]
df_prod["cantidad"] = pd.to_numeric(df_prod["cantidad"], errors="coerce").fillna(0).astype(int)
df_prod = df_prod[df_prod["cantidad"] > 0].sort_values("cantidad", ascending=False)

productos = df_prod.head(200).to_dict("records")
productos_total = len(df_prod)
print(f"Found {productos_total} products, top: {productos[0] if productos else 'none'}")

# ========================================
# 6. DAILY TRACKING - MARZO
# ========================================
print("\nProcessing daily tracking - Marzo...")
df_mar = pd.read_csv(f"{BASE}/SEGUIMIENTO DIARIO ARG META - MARZO 2026.csv")
print(f"Marzo columns: {list(df_mar.columns)}")
print(df_mar.head())

# Map day names
DIAS = {1:"SABADO",2:"DOMINGO",3:"LUNES",4:"MARTES",5:"MIERCOLES",6:"JUEVES",7:"VIERNES",
        8:"SABADO",9:"DOMINGO",10:"LUNES",11:"MARTES",12:"MIERCOLES",13:"JUEVES",14:"VIERNES",
        15:"SABADO",16:"DOMINGO",17:"LUNES",18:"MARTES",19:"MIERCOLES",20:"JUEVES",21:"VIERNES",
        22:"SABADO",23:"DOMINGO",24:"LUNES",25:"MARTES",26:"MIERCOLES",27:"JUEVES",28:"VIERNES",
        29:"SABADO",30:"DOMINGO",31:"LUNES"}

seguimiento_diario = []
for _, row in df_mar.iterrows():
    try:
        dia_col = df_mar.columns[0]
        fecha_col = df_mar.columns[1]
        ord_col = df_mar.columns[2]
        dia_nombre = str(row[dia_col]).strip() if pd.notna(row[dia_col]) else ""
        fecha = int(row[fecha_col]) if pd.notna(row[fecha_col]) else 0
        ordenes = int(row[ord_col]) if pd.notna(row[ord_col]) else 0
        if fecha > 0 and ordenes > 0:
            if not dia_nombre or dia_nombre == "nan":
                dia_nombre = DIAS.get(fecha, "")
            seguimiento_diario.append({
                "dia_semana": dia_nombre.upper(),
                "fecha": fecha,
                "ordenes": ordenes,
                "nota": None,
            })
    except (ValueError, TypeError):
        pass

print(f"Marzo: {len(seguimiento_diario)} days, total={sum(d['ordenes'] for d in seguimiento_diario)}")
marzo_total = sum(d['ordenes'] for d in seguimiento_diario)
marzo_prom = round(marzo_total / len(seguimiento_diario)) if seguimiento_diario else 0

# ========================================
# 7. DAILY TRACKING - ABRIL
# ========================================
print("\nProcessing daily tracking - Abril...")
df_abr = pd.read_csv(f"{BASE}/SEGUIMIENTO DIARIO ARG META - ABRIL 2026-2.csv")
print(f"Abril columns: {list(df_abr.columns)}")
print(df_abr.head(10))

DIAS_ABRIL = {1:"MARTES",2:"MIERCOLES",3:"JUEVES",4:"VIERNES",5:"SABADO",6:"DOMINGO",7:"LUNES",
              8:"MARTES",9:"MIERCOLES",10:"JUEVES",11:"VIERNES",12:"SABADO",13:"DOMINGO",14:"LUNES",
              15:"MARTES",16:"MIERCOLES",17:"JUEVES",18:"VIERNES",19:"SABADO",20:"DOMINGO",21:"LUNES",
              22:"MARTES",23:"MIERCOLES",24:"JUEVES",25:"VIERNES",26:"SABADO",27:"DOMINGO",28:"LUNES",
              29:"MARTES",30:"MIERCOLES"}

seguimiento_abril = []
for _, row in df_abr.iterrows():
    try:
        dia_col = df_abr.columns[0]
        fecha_col = df_abr.columns[1]
        ord_col = df_abr.columns[2]
        fecha = int(row[fecha_col]) if pd.notna(row[fecha_col]) else 0
        ordenes = int(row[ord_col]) if pd.notna(row[ord_col]) else 0
        if fecha > 0 and ordenes > 0:
            dia_nombre = DIAS_ABRIL.get(fecha, "")
            seguimiento_abril.append({
                "dia_semana": dia_nombre,
                "fecha": fecha,
                "ordenes": ordenes,
                "nota": None,
            })
    except (ValueError, TypeError):
        pass

print(f"Abril: {len(seguimiento_abril)} days with data, total={sum(d['ordenes'] for d in seguimiento_abril)}")

# ========================================
# 8. META INFO
# ========================================
META_MOV_ABRIL = 12000
META_ING_ABRIL = 16000
TASA_MOV = 0.75  # 75% from resumen ejecutivo

meta_info = {
    "meta_movilizadas_abril": META_MOV_ABRIL,
    "tasa_movilizacion": TASA_MOV,
    "meta_ingresadas_abril": META_ING_ABRIL,
    "dias_abril": 30,
    "promedio_diario_necesario": round(META_ING_ABRIL / 30),  # ~533/day
    "marzo_total_ordenes": marzo_total,
    "marzo_promedio_diario": marzo_prom,
}

# ========================================
# COUNTS
# ========================================
total_proveedores = len(proveedores_list)
total_sellers = len(ds_list)

# ========================================
# BUILD FINAL JSON
# ========================================
dashboard_data = {
    "resumen": {
        **resumen,
        "total_proveedores": total_proveedores,
        "total_sellers": total_sellers,
    },
    "proveedores": proveedores_list,
    "sellers_top": sellers_top,
    "seguimiento_diario": seguimiento_diario,
    "seguimiento_abril": seguimiento_abril,
    "productos": productos,
    "productos_total": productos_total,
    "meta_info": meta_info,
    "dropshippers": ds_list,
    "dropshippers_total": len(ds_list),
}

output_path = "/tmp/segundo-cerebro/data/dashboard_data_argentina.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(dashboard_data, f, ensure_ascii=False, indent=2)

print(f"\n\n=== ARGENTINA DASHBOARD DATA ===")
print(f"Proveedores: {total_proveedores}")
print(f"Sellers/Dropshippers: {total_sellers}")
print(f"Productos: {productos_total}")
print(f"Enero: Ing={ene_ing}, Mov={ene_mov}, Ent={ene_ent}, Dev={ene_dev}")
print(f"Febrero: Ing={feb_ing}, Mov={feb_mov}, Ent={feb_ent}, Dev={feb_dev}")
print(f"Marzo: Ing={mar_ing}, Mov={mar_mov}, Ent={mar_ent}, Dev={mar_dev}")
print(f"Meta Abril: {META_ING_ABRIL} ing / {META_MOV_ABRIL} mov")
print(f"Marzo daily: {len(seguimiento_diario)} days, total={marzo_total}, prom={marzo_prom}")
print(f"Abril daily: {len(seguimiento_abril)} days loaded")
print(f"\nSaved to: {output_path}")
