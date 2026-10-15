from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
J=Path(__file__).resolve().parents[1]
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',24)
for x in 'ABC':
    folder=J/'screenshots'/x
    frames=[Image.open(folder/f'animation-{i}.png').convert('RGB') for i in range(1,7)]
    strip=Image.new('RGB',(1920,1080),'#060b18');d=ImageDraw.Draw(strip)
    d.text((35,25),f'{x} / HAYATE / QCF + LP / SIX ACTUAL CAPTURED FRAMES',font=font,fill='#9dfaff')
    for i,im in enumerate(frames):
        im.thumbnail((320,180));strip.paste(im,(320*i,440));d.text((320*i+12,392),f'+{i*5} sim frames',font=font,fill='white')
    d.text((35,680),'Original screenshots: animation-1.png through animation-6.png (1920 x 1080 each).',font=font,fill='white')
    d.text((35,724),'Spacing fixture only. The game receives motion inputs; no pose or projectile is injected.',font=font,fill='#aab7c9')
    strip.save(folder/'18-special-strip.png')
    # Contact sheets used to inspect every captured image. Originals remain untouched.
    imgs=sorted(folder.glob('*.png'))
    names=[]
    for k in range(0,len(imgs),6):
        contact=Image.new('RGB',(1920,1746),'#101525');draw=ImageDraw.Draw(contact)
        for i,p in enumerate(imgs[k:k+6]):
            im=Image.open(p).convert('RGB');im.thumbnail((960,540));xx=(i%2)*960;yy=(i//2)*582
            contact.paste(im,(xx,yy+40));draw.text((xx+10,yy+7),f'{x} / {p.name}',font=font,fill='white')
        out=folder/f'contact-{k//6+1}.jpg';contact.save(out,quality=92);names.append(str(out.relative_to(J)).replace('\\','/'))
    (J/'logs'/x/'image-inventory.json').write_text(json.dumps({'images':[p.name for p in imgs],'contact_sheets':names,'dimensions':{p.name:list(Image.open(p).size) for p in imgs}},indent=2),encoding='utf-8')
print('Animation strips and visual inspection contact sheets generated.')
