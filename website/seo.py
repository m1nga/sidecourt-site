"""Structured data for the public SideCourt pages. Facts only; no claims about users or rankings."""
import json
import html
import re

SITE = 'https://sidecourt.space'
PUBLISHER = {'@type': 'Organization', 'name': 'SideCourt', 'url': SITE + '/', 'logo': SITE + '/favicon.svg'}

ORGANIZATION = [
    {'@context': 'https://schema.org', '@type': 'Organization', 'name': 'SideCourt', 'url': SITE + '/', 'logo': SITE + '/favicon.svg',
     'description': 'SideCourt is a home for independent work: small products people make for themselves and then share, with a place to reply, help and follow what changes.'},
    {'@context': 'https://schema.org', '@type': 'WebSite', 'name': 'SideCourt', 'url': SITE + '/', 'inLanguage': 'en'},
]

def app(name, url, description, category, os, extra=None):
    data = {'@context': 'https://schema.org', '@type': 'SoftwareApplication', 'name': name, 'url': url, 'description': description,
            'applicationCategory': category, 'operatingSystem': os, 'isAccessibleForFree': True,
            'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'},
            'author': {'@type': 'Person', 'name': 'M1NGA', 'url': SITE + '/'}, 'publisher': PUBLISHER, 'isPartOf': {'@type': 'WebSite', 'name': 'SideCourt', 'url': SITE + '/'}}
    data.update(extra or {})
    return data

SOFTWARE = {
    'cleanpause': app('CleanPause', SITE + '/cleanpause/',
        'Pause keyboard and trackpad input, wipe your Mac, and return when you are ready. Free for macOS 13+. Windows is a preview.',
        'UtilitiesApplication', ['macOS', 'Windows'],
        {'inLanguage': ['en', 'zh'], 'downloadUrl': SITE + '/cleanpause/'}),
    'daycup': app('DayCup', SITE + '/drops/daycup/',
        'Brew, remember and share your coffee. Starting recipes, a private cup journal and editable photo cards. Start without an account; private cloud sync is optional.',
        'LifestyleApplication', 'Any (web browser, add to home screen)',
        {'inLanguage': ['zh-CN', 'en']}),
    'earbrief': app('EarBrief', SITE + '/drops/earbrief/',
        'Turn work notes and PDF reports into Chinese or English audio episodes you can listen to while walking, cooking or driving. Bring your own AI key and sign in with a SideCourt account. Provider quotas and charges depend on your account.',
        'MultimediaApplication', 'Any (web browser, add to home screen)',
        {'inLanguage': ['en', 'zh-CN'], 'featureList': ['PDF and text input', 'Chinese and English audio', 'Transcripts', 'Audio downloads']}),
}

def inject_json_ld(document, data):
    """Insert one JSON-LD block before </head>; never twice, never touching the body."""
    if 'application/ld+json' in document:
        return document
    block = '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False).replace('</', '<\\/') + '</script>'
    assert '</head>' in document
    return document.replace('</head>', block + '</head>', 1)


def search_metadata(document, title, description, url):
    """One consistent, crawlable identity. Only head metadata is changed."""
    head, body = document.split('</head>', 1)
    head = re.sub(r'<title>.*?</title>', '', head, flags=re.I | re.S)
    # Match attribute values, independent of order, to avoid duplicate metadata.
    def keep_meta(match):
        tag = match.group(0)
        pairs = dict((k.lower(), v) for k, _, v in re.findall(r'([\w:-]+)\s*=\s*([\"\'])(.*?)\2', tag))
        key = pairs.get('name', pairs.get('property', '')).lower()
        managed = {'description', 'og:title', 'og:description', 'og:url', 'og:type', 'og:site_name', 'twitter:card', 'twitter:title', 'twitter:description'}
        return '' if key in managed else tag
    head = re.sub(r'<meta\b[^>]*>', keep_meta, head, flags=re.I)
    esc = lambda value: html.escape(value, quote=True)
    tags = '<title>' + esc(title) + '</title>'
    for key, value in [('description', description), ('og:title', title), ('og:description', description), ('og:url', url), ('og:type', 'website'), ('og:site_name', 'SideCourt'), ('twitter:card', 'summary'), ('twitter:title', title), ('twitter:description', description)]:
        attr = 'property' if key.startswith('og:') else 'name'
        tags += '<meta ' + attr + '="' + key + '" content="' + esc(value) + '">'
    return head + tags + '</head>' + body


PUBLIC_SEARCH = {
    'index.html': ('SideCourt — Share Independent Work and Find Useful Help', 'Discover independent projects, share what you are making, and offer or ask for specific help. Explore products and reusable AI skills made by Ming.', '/'),
    'cleanpause/index.html': ('CleanPause — Pause Your Mac Keyboard and Trackpad for Cleaning', 'Pause keyboard and trackpad input while cleaning your Mac. Free for macOS 13+, signed and notarized. A separate unsigned Windows preview is available.', '/cleanpause/'),
    'drops/daycup/index.html': ('DayCup — Coffee Brew Timer, Recipes and Private Journal', 'Brew espresso, latte, Americano or V60, time one cup and keep taste notes. Start offline as a guest; SideCourt account sync and sharing are optional.', '/drops/daycup/'),
    'drops/earbrief/index.html': ('EarBrief — Turn PDF Reports and Notes into Audio', 'Listen to work reports in English or Chinese, with transcripts and audio downloads. Bring your own AI key; provider quotas and charges may apply.', '/drops/earbrief/'),
}

def finish_search_metadata(out):
    for relative, (title, description, path) in PUBLIC_SEARCH.items():
        file = out / relative
        file.write_text(search_metadata(file.read_text(), title, description, SITE + path))
    # Keep the invitation test reachable, but do not present it as a search landing page.
    test = out / 'drops/redbot/test/index.html'
    text = test.read_text()
    if 'name="robots"' not in text:
        text = text.replace('</head>', '<meta name="robots" content="noindex,follow"></head>', 1)
    test.write_text(text)
