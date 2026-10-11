import sys,json,io
from pypdf import PdfReader
data=sys.stdin.buffer.read()
reader=PdfReader(io.BytesIO(data),strict=True)
a4=len(reader.pages)==2 and all(abs(float(p.mediabox.width)-595.276)<1 and abs(float(p.mediabox.height)-841.89)<1 for p in reader.pages)
embedded=True
for p in reader.pages:
    fonts=p.get('/Resources',{}).get('/Font',{})
    for ref in fonts.values():
        f=ref.get_object()
        descendants=f.get('/DescendantFonts',[f])
        for item in descendants:
            d=item.get_object().get('/FontDescriptor')
            if not d or not any(k in d.get_object() for k in ['/FontFile','/FontFile2','/FontFile3']): embedded=False
texts=[p.extract_text() or '' for p in reader.pages]
hangul=all(any('\uac00'<=c<='\ud7a3' for c in t) and '\ufffd' not in t for t in texts)
result={'pages':len(reader.pages),'a4':a4,'embeddedFonts':embedded,'hangul':hangul}
if not(a4 and embedded and hangul):
    print(json.dumps(result));sys.exit(1)
print(json.dumps(result))
