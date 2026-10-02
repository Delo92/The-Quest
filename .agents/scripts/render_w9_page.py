from pathlib import Path
import sys

import pymupdf


source = Path(sys.argv[1])
destination = Path(sys.argv[2])
document = pymupdf.open(source)
page = document.load_page(0)
image = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
image.save(destination)

print(
    f"Rendered page 1 of {document.page_count}: "
    f"{image.width}x{image.height} px, {destination.stat().st_size} bytes"
)