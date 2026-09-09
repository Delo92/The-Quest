from pathlib import Path

import fitz


source = Path("attached_assets/Starr_Struck_Show_Treatment_Final_1788976201769.pdf")
output_dir = Path(".agents/outputs/starr-struck-treatment")
output_dir.mkdir(parents=True, exist_ok=True)

document = fitz.open(source)
print(f"pages={document.page_count}")
for index, page in enumerate(document):
    print(f"\n--- page {index + 1} ---")
    print(page.get_text("text")[:12000])
    pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    output_path = output_dir / f"page-{index + 1}.png"
    pixmap.save(output_path)
    print(f"rendered={output_path}")