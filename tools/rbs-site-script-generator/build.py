"""Builds index.html (one self-contained page) from src/. Run: python3 build.py"""
import pathlib
here = pathlib.Path(__file__).parent
ui = (here / 'src/ui.html').read_text()
for marker, name in (('/*CORE*/', 'core.js'), ('/*EXAMPLES*/', 'examples.js')):
    ui = ui.replace(marker, (here / 'src' / name).read_text(), 1)
(here / 'index.html').write_text(ui)
print('wrote index.html')
