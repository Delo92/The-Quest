from pathlib import Path
import fitz

source = Path("attached_assets/1099_form_1790278740415.pdf")
output_dir = Path(".agents/outputs/1099-form-pages")
output_dir.mkdir(parents=True, exist_ok=True)

document = fitz.open(source)
print(f"Pages: {document.page_count}")
print(f"Metadata: {document.metadata}")

for index, page in enumerate(document):
    text = page.get_text("text")
    preview = " ".join(text.split())[:150]
    widgets = list(page.widgets() or [])
    print(f"Page {index + 1}: {page.rect.width:.0f}x{page.rect.height:.0f}, widgets={len(widgets)}, {preview}")
    if "PAYER" in text.upper() and "RECIPIENT" in text.upper():
        output = output_dir / f"page-{index + 1}.png"
        page.get_pixmap(matrix=fitz.Matrix(1.8, 1.8), alpha=False).save(output)
        print(f"Rendered: {output}")