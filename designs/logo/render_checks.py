"""Audit all masters and render local light and dark samples with the skill tools.

Run with the logo-design skill's .venv/bin/python. Dark samples reverse black or
ink to paper. They retain cobalt. The color masters remain ink and cobalt only.
"""
from pathlib import Path
import json
import subprocess
import sys
import xml.etree.ElementTree as ET

sys.dont_write_bytecode = True
OUT = Path(__file__).resolve().parent
SKILL = Path('/home/darko/.claude/skills/logo-design')
sys.path.insert(0,str(SKILL/'scripts'))
import render_png

PAPER = '#f8fafc'


def validate_master(file):
    root = ET.fromstring(file.read_text())
    for element in root.iter():
        tag = element.tag.rsplit('}',1)[-1]
        assert tag in {'svg','title','g','path'}, (file,tag)
        assert not any(key.rsplit('}',1)[-1].lower().startswith('on') for key in element.attrib)
        assert not any(key.rsplit('}',1)[-1] == 'href' for key in element.attrib)
        assert not any('url(' in value for value in element.attrib.values())


def audit_masters(files):
    result = subprocess.run([sys.executable,str(SKILL/'scripts/svg_audit.py'),
        *map(str,files),'--json','--bg',PAPER],check=True,capture_output=True,text=True)
    audit = json.loads(result.stdout)
    (OUT/'audit.json').write_text(json.dumps(audit,indent=2)+'\n')
    print('SVG audit:', [(Path(a['file']).name,a['score'],[f['code'] for f in a['findings']]) for a in audit])


def render_sample(source, target, width, height, mode, bg):
    backend = render_png.render(str(source),str(target),width,height,bg=bg,backend='cairosvg')
    assert backend, target
    assert render_png.png_size(target) == (width,height), target
    return {'file':str(target.relative_to(OUT)),'width':width,'height':height,
            'background':bg,'reversed':mode=='dark','backend':backend}


def render_master(file, render_dir, reverse_dir, ink, dark):
    raw = file.read_text()
    reversed_file = reverse_dir/file.name
    reversed_file.write_text(raw.replace('#000000',PAPER).replace(ink,PAPER))
    values = list(map(float, ET.fromstring(raw).attrib['viewBox'].split()))
    ratio = values[2]/values[3]
    records = []
    for size in (16,28,32,64,256):
        width,height = round(size*ratio),size
        for mode,bg,source in [('light',PAPER,file),('dark',dark,reversed_file)]:
            target = render_dir/f'{file.stem}-{size}px-{mode}.png'
            records.append(render_sample(source,target,width,height,mode,bg))
    return records


def write_render_report(files, records):
    (OUT/'render-checks.json').write_text(json.dumps({'master_count':len(files),'renders':records,
        'overview':{'file':'overview.png','width':1600,'height':1400,'backend':'cairosvg'},
        'checks':{'master_xml_allowlist':True,'external_references':False,'scripts':False,
                  'live_master_text':False,'raster_master_images':False},
        'sizing':'Pixel size names specify height. Symbols are square. Large height is 256px.',
        'dark_mode':'Black and ink reverse to paper. Cobalt remains unchanged.'},indent=2)+'\n')
    print(f'Rendered {len(records)} PNG samples and overview.png with CairoSVG.')


def main():
    palette = json.loads((OUT/'palette.json').read_text())
    ink, dark = palette['ink']['hex'], palette['graphite']['hex']
    files = sorted(p for p in OUT.glob('*.svg') if p.name != 'overview.svg')
    assert len(files) == 10
    for file in files:
        validate_master(file)
    audit_masters(files)
    render_dir = OUT/'renders'
    reverse_dir = render_dir/'reversed-source'
    reverse_dir.mkdir(parents=True,exist_ok=True)
    records = []
    for file in files:
        records.extend(render_master(file,render_dir,reverse_dir,ink,dark))
    assert render_png.render(str(OUT/'overview.svg'),str(OUT/'overview.png'),1600,1400,backend='cairosvg')
    write_render_report(files,records)


if __name__ == '__main__':
    main()
