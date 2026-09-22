"""Structured data for the public SideCourt pages. Facts only; no claims about users or rankings."""
import json

SITE = 'https://sidecourt.space'
PUBLISHER = {'@type': 'Organization', 'name': 'SideCourt', 'url': SITE + '/', 'logo': SITE + '/favicon.svg'}

ORGANIZATION = [
    {'@context': 'https://schema.org', '@type': 'Organization', 'name': 'SideCourt', 'url': SITE + '/', 'logo': SITE + '/favicon.svg',
     'description': 'SideCourt is a home for independent work: small products people make for themselves and then share, with a place to reply, help and follow what changes.'},
    {'@context': 'https://schema.org', '@type': 'WebSite', 'name': 'SideCourt', 'url': SITE + '/', 'inLanguage': ['en', 'zh']},
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
        'A small Mac app that pauses keyboard and trackpad input so you can wipe your Mac clean, then brings everything back when you are ready. Windows preview available.',
        'UtilitiesApplication', ['macOS', 'Windows'],
        {'inLanguage': ['en', 'zh'], 'downloadUrl': SITE + '/cleanpause/'}),
    'daycup': app('Daycup', SITE + '/drops/daycup/',
        'An offline coffee companion: save your machine, grinder and beans, start from a recipe, time the brew, record how it tasted, and change one thing next time. Chinese and English; no account needed.',
        'LifestyleApplication', 'Any (web browser, add to home screen)',
        {'inLanguage': ['zh-CN', 'en'], 'alternateName': '每日一杯'}),
    'earbrief': app('EarBrief', 'https://earbrief.sidecourt.space/',
        'Turn work notes and PDF reports into Chinese or English audio episodes you can listen to while walking, cooking or driving. Bring your own free AI key; sign in with a SideCourt account.',
        'MultimediaApplication', 'Any (web browser, add to home screen)',
        {'inLanguage': ['en', 'zh-CN'], 'sameAs': [SITE + '/drops/earbrief/']}),
}

def inject_json_ld(document, data):
    """Insert one JSON-LD block before </head>; never twice, never touching the body."""
    if 'application/ld+json' in document:
        return document
    block = '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False).replace('</', '<\\/') + '</script>'
    assert '</head>' in document
    return document.replace('</head>', block + '</head>', 1)
