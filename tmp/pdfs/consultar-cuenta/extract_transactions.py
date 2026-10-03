import json
import re
from pathlib import Path

import pdfplumber

PDF = Path(r"C:\Users\Administrator\Desktop\consultar-cuenta.pdf")
OUT = Path(r"C:\Users\Administrator\Desktop\Proyectos AvTech 2.0\AvTech\tmp\pdfs\consultar-cuenta\transactions.json")


def money(text):
    matches = re.findall(r"(?:\d{1,3}(?:,\d{3})*|\d+)\.\d{2}", text or "")
    return float(matches[-1].replace(",", "")) if matches else None


def group_lines(words, tolerance=2.0):
    lines = []
    for word in sorted(words, key=lambda w: (w["top"], w["x0"])):
        if not lines or abs(word["top"] - lines[-1][0]["top"]) > tolerance:
            lines.append([word])
        else:
            lines[-1].append(word)
    return lines


def text_in(line, xmin, xmax):
    return " ".join(w["text"] for w in line if xmin <= w["x0"] < xmax).strip()


def parse_details(concept_lines):
    fields = {
        "tipo": concept_lines[0] if concept_lines else "",
        "persona": "",
        "banco": "",
        "cuenta": "",
        "detalle": "",
        "clave_rastreo": "",
    }
    if not concept_lines:
        return fields

    rastreo_idx = next((i for i, line in enumerate(concept_lines) if "CLAVE DE RASTREO" in line.upper()), None)
    if rastreo_idx is not None:
        fields["clave_rastreo"] = re.sub(r"^.*?CLAVE DE RASTREO\s*", "", concept_lines[rastreo_idx], flags=re.I)
    if len(concept_lines) >= 2 and any(k in fields["tipo"].upper() for k in ("DEPOSITO SPEI", "TRANSFERENCIA SPEI")):
        fields["persona"] = concept_lines[1]
        if len(concept_lines) >= 3:
            match = re.match(r"^(.*?)(?:\s+)(\d{10,18})$", concept_lines[2])
            if match:
                fields["banco"], fields["cuenta"] = match.group(1), match.group(2)
            else:
                fields["banco"] = concept_lines[2]
        end = rastreo_idx if rastreo_idx is not None else len(concept_lines)
        fields["detalle"] = " | ".join(concept_lines[3:end])
    elif len(concept_lines) > 1:
        fields["detalle"] = " | ".join(concept_lines[1:])
    return fields


transactions = []
with pdfplumber.open(PDF) as doc:
    for page_no in range(2, 56):
        page = doc.pages[page_no - 1]
        words = [w for w in page.extract_words() if 135 <= w["top"] <= 785]
        lines = group_lines(words)
        starts = []
        for idx, line in enumerate(lines):
            month = text_in(line, 0, 35).upper()
            date_ref = text_in(line, 35, 105).replace(" ", "")
            if month.startswith("AGO.") and re.fullmatch(r"\d{10,12}", date_ref):
                starts.append(idx)

        for pos, start_idx in enumerate(starts):
            end_idx = starts[pos + 1] if pos + 1 < len(starts) else len(lines)
            start_top = lines[start_idx][0]["top"]
            block = [line for line in lines[start_idx:end_idx] if line[0]["top"] <= start_top + 65]
            first = block[0]
            date_ref = text_in(first, 35, 105).replace(" ", "")
            ref = date_ref[-10:]
            prefixed_day = date_ref[:-10]
            date_bits = text_in(first, 0, 35).split()
            day = next((x for x in date_bits if x.isdigit()), "")
            if prefixed_day:
                day = prefixed_day
            if not day:
                for candidate_line in block[1:]:
                    next_date = text_in(candidate_line, 0, 45)
                    if re.fullmatch(r"\d{1,2}", next_date):
                        day = next_date
                        break

            cargos = text_in(first, 350, 430)
            abonos = text_in(first, 430, 505)
            saldo = text_in(first, 505, 590)
            concept_lines = []
            for line in block:
                concept = text_in(line, 105, 350)
                if concept:
                    concept_lines.append(concept)
            if concept_lines and not any(k in concept_lines[0].upper() for k in ("DEPOSITO SPEI", "TRANSFERENCIA SPEI")):
                concept_lines = concept_lines[:2]

            details = parse_details(concept_lines)
            transactions.append({
                "fecha": f"2026-08-{int(day):02d}" if day else "",
                "referencia": ref,
                "concepto": " | ".join(concept_lines),
                **details,
                "cargos": money(cargos),
                "abonos": money(abonos),
                "saldo": money(saldo),
                "pagina": page_no,
            })

payload = {
    "source": str(PDF),
    "periodo": "2026-08-01/2026-08-31",
    "saldo_anterior": 120304.80,
    "abonos_resumen": 1447043.27,
    "cargos_resumen": 1269275.80,
    "saldo_actual": 298072.27,
    "saldo_promedio": 321896.54,
    "rendimientos": 1722.95,
    "comisiones": 319.00,
    "movimientos": transactions,
}
OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

sum_cargos = sum(x["cargos"] or 0 for x in transactions)
sum_abonos = sum(x["abonos"] or 0 for x in transactions)
print(f"movimientos={len(transactions)}")
print(f"cargos={sum_cargos:.2f} diferencia={sum_cargos-payload['cargos_resumen']:.2f}")
print(f"abonos={sum_abonos:.2f} diferencia={sum_abonos-payload['abonos_resumen']:.2f}")
print(f"primer={transactions[0] if transactions else None}")
print(f"ultimo={transactions[-1] if transactions else None}")
