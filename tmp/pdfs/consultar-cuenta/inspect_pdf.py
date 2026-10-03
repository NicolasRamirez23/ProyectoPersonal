import sys
import pdfplumber

PDF = r"C:\Users\Administrator\Desktop\consultar-cuenta.pdf"

with pdfplumber.open(PDF) as doc:
    page = doc.pages[int(sys.argv[1]) - 1 if len(sys.argv) > 1 else 2]
    for word in page.extract_words()[:220]:
        print(f"{word['top']:6.1f} {word['x0']:6.1f} {word['x1']:6.1f} {word['text']}")
