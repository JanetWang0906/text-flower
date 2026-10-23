"""Package the generated offline directory; preserve the prior ZIP."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from argparse import ArgumentParser

root = Path(__file__).resolve().parent.parent
source = root / 'minitool'
parser = ArgumentParser(description='Package the independent offline mini-tool without replacing the historical 2.0 ZIP.')
parser.add_argument('--output', type=Path, default=root / 'output' / '字里花间-离线礼物分享-v3.0.zip')
target = parser.parse_args().output
if not target.is_absolute():
    target = root / target
target.parent.mkdir(parents=True, exist_ok=True)
allowed = {'.html', '.js', '.css', '.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif', '.woff', '.woff2', '.json'}
files = sorted(p for p in source.rglob('*') if p.is_file() and p.suffix.lower() in allowed)
assert source / 'index.html' in files
assert not any(p.suffix == '.html' and p.name != 'index.html' for p in files)
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for file in files:
        archive.write(file, file.relative_to(source).as_posix())
with ZipFile(target) as archive:
    assert 'index.html' in archive.namelist()
    assert len(archive.namelist()) == len(files)
    for file in files:
        assert archive.read(file.relative_to(source).as_posix()) == file.read_bytes()
assert target.stat().st_size <= 10 * 1024 * 1024
print(f'{target.name}: {len(files)} files, {target.stat().st_size:,} bytes, ZIP bytes match minitool/')
