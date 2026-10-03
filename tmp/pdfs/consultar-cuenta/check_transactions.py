import json
from pathlib import Path

path = Path(r"C:\Users\Administrator\Desktop\Proyectos AvTech 2.0\AvTech\tmp\pdfs\consultar-cuenta\transactions.json")
data = json.loads(path.read_text(encoding="utf-8"))
previous = data["saldo_anterior"]
for i, row in enumerate(data["movimientos"], start=1):
    expected = round(previous + (row["abonos"] or 0) - (row["cargos"] or 0), 2)
    if row["saldo"] is None or abs(expected - row["saldo"]) > 0.009:
        print(i, "page", row["pagina"], "prev", previous, "expected", expected, "actual", row["saldo"], row["referencia"], row["tipo"])
    if row["saldo"] is not None:
        previous = row["saldo"]
