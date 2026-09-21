"""Public pages for every published SideCourt post and public author, built at Pages build time.

GitHub Pages has no rewrite rules: an address only answers with 200 when a folder with an
index.html exists for it. A post published after the last deploy would otherwise open through
404.html, with a 404 status and the generic title, so link previews and search results are wrong.
build.py calls publish_public_pages() on every build; the list comes from the same public read
the website itself uses (the publishable key in config.js, never any other key).

Pure helpers first so they can be tested without a network: python3 -m unittest discover website
"""
import html
import json
import pathlib
import re
import urllib.request

SITE = 'https://sidecourt.space'
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
HANDLE = re.compile(r'^[A-Za-z0-9_]{3,24}$')
DESCRIPTION_LIMIT = 200

TITLE_TAG = re.compile(r'<title>[^<]*</title>', re.IGNORECASE)
DESCRIPTION_TAG = re.compile(r'<meta\s+name="description"\s+content="[^"]*"\s*/?>', re.IGNORECASE)
CANONICAL_TAG = re.compile(r'<link\s+rel="canonical"\s+href="[^"]*"\s*/?>', re.IGNORECASE)
OG_TAG = re.compile(r'<meta\s+property="og:[a-z:_]+"\s+content="[^"]*"\s*/?>\n?', re.IGNORECASE)


def read_config(config_js):
    """window.SIDECOURT_CONFIG={...}; -> dict. Reads only what the public site already ships."""
    text = pathlib.Path(config_js).read_text()
    return json.loads(text[text.index('{'):text.rindex('}') + 1])


def collapse(text):
    return re.sub(r'\s+', ' ', str(text or '')).strip()


def summary(text, limit=DESCRIPTION_LIMIT):
    """First ~limit characters of a description, whitespace collapsed, cut at a word when possible."""
    text = collapse(text)
    if len(text) <= limit:
        return text
    cut = text[:limit]
    space = cut.rfind(' ')
    if space > limit // 2:
        cut = cut[:space]
    return cut.rstrip(' ,;:.-') + '…'


def inject_head(application, title, description, canonical, og_type='website', image=''):
    """Return the application's index.html with this page's title, description, canonical and
    Open Graph tags. Only the first tag of each kind inside <head> is replaced; anything the
    application does not carry is inserted after <title>. Every value is HTML-escaped."""
    head_end = application.find('</head>')
    if head_end < 0:
        raise ValueError('application index.html has no <head>')
    head, rest = application[:head_end], application[head_end:]
    head = OG_TAG.sub('', head)
    esc = lambda value: html.escape(collapse(value), quote=True)
    title_tag = '<title>' + esc(title) + '</title>'
    description_tag = '<meta name="description" content="' + esc(description) + '">'
    canonical_tag = '<link rel="canonical" href="' + esc(canonical) + '">'
    if TITLE_TAG.search(head):
        head = TITLE_TAG.sub(lambda m: title_tag, head, count=1)
    else:
        head = head.replace('<head>', '<head>\n' + title_tag, 1)
    if DESCRIPTION_TAG.search(head):
        head = DESCRIPTION_TAG.sub(lambda m: description_tag, head, count=1)
    else:
        head = head.replace(title_tag, title_tag + '\n' + description_tag, 1)
    if CANONICAL_TAG.search(head):
        head = CANONICAL_TAG.sub(lambda m: canonical_tag, head, count=1)
    else:
        head = head.replace(description_tag, description_tag + '\n' + canonical_tag, 1)
    og = [('og:title', title), ('og:description', description), ('og:url', canonical), ('og:type', og_type)]
    if isinstance(image, str) and re.match(r'^https://', image):
        og.append(('og:image', image))
    og_tags = ''.join('<meta property="' + name + '" content="' + esc(value) + '">\n' for name, value in og)
    head = head.replace(canonical_tag, canonical_tag + '\n' + og_tags.rstrip('\n'), 1)
    return head + rest


def public_pages(works):
    """Turn the sc_public_works rows into [(relative folder, title, description, canonical, og_type, image)].
    Rows with anything but a strict uuid or handle are skipped; nothing else about them is trusted."""
    pages, handles = [], []
    for work in works if isinstance(works, list) else []:
        if not isinstance(work, dict):
            continue
        work_id = work.get('id')
        data = work.get('data') if isinstance(work.get('data'), dict) else {}
        if isinstance(work_id, str) and UUID.match(work_id):
            name = collapse(data.get('name')) or 'A post'
            description = summary(data.get('description')) or 'A public post on SideCourt.'
            cover = data.get('cover') if isinstance(data.get('cover'), str) else ''
            pages.append(('work/' + work_id, name + ' · SideCourt', description, SITE + '/work/' + work_id + '/', 'article', cover))
        player = work.get('player')
        handle = player if isinstance(player, str) else player.get('handle') if isinstance(player, dict) else None
        if isinstance(handle, str) and HANDLE.match(handle) and handle not in handles:
            handles.append(handle)
    for handle in handles:
        pages.append(('people/' + handle, '@' + handle + ' · SideCourt', 'Posts by @' + handle + ' on SideCourt.', SITE + '/people/' + handle + '/', 'profile', ''))
    return pages


def fetch_public_works(config, timeout=20):
    """The same public read the website performs. Raises on any failure; the caller decides."""
    url = config['supabaseUrl'].rstrip('/') + '/rest/v1/rpc/sc_public_works'
    key = config['publishableKey']
    request = urllib.request.Request(url, data=b'{}', method='POST', headers={
        'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Accept': 'application/json'})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError('HTTP ' + str(response.status))
        works = json.loads(response.read().decode('utf-8'))
    if not isinstance(works, list):
        raise RuntimeError('unexpected response shape')
    return works


def publish_public_pages(out, application, works):
    """Write one folder per page under out. Returns the written pages (same tuples as public_pages)."""
    pages = public_pages(works)
    for folder, title, description, canonical, og_type, image in pages:
        target = pathlib.Path(out) / folder
        target.mkdir(parents=True, exist_ok=True)
        (target / 'index.html').write_text(inject_head(application, title, description, canonical, og_type, image))
    return pages


def sitemap_xml(urls):
    body = ''.join('<url><loc>' + html.escape(url, quote=True) + '</loc></url>' for url in urls)
    return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + body + '</urlset>'
