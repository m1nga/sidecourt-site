"""Public pages for published SideCourt works and their authors, built at Pages build time.

GitHub Pages has no rewrite rules: an address only answers with 200 when a folder with an index.html exists for it.
build.py copies the committed application (platform-preview/, staged by site/platform/scripts/stage-hosting.mjs) and
then calls publish_site_pages(), which reads the public list the website itself reads (the publishable key in
config.js, never any other key) and rewrites the public pages with the data of that moment.

This file is the twin of site/platform/scripts/public-page-html.mjs in the private source repository. For the same
input both produce byte-identical pages, public-pages.json, sitemap and llms.txt entries (the source repository's
tests/hosting-parity.test.mjs runs both). Change one, change the other.

Page states (public-pages.json `state`):
  listed    discoverable (sc_public_works): full head, canonical with the trailing slash the host serves, indexable.
  unlisted  public by link only (author's choice or platform withheld from discovery): full head, noindex.
  limited   public by link while restricted: neutral head without the work's title, text or picture, noindex.
  withdrawn a page existed before and the work is no longer public (withdrawn, archived, taken down, hidden,
            deleted): neutral placeholder head, noindex. The body stays the application, which reads the live state.
A link-only work that never had a page opens through 404.html (the application reads sc_public_post); nobody can
list link-only works anonymously.

Pure helpers first so they can be tested without a network: python3 -m unittest discover -s website -p 'test_*.py'
"""
import json
import pathlib
import re
import urllib.request

SITE = 'https://sidecourt.space'
DESCRIPTION_LIMIT = 200
UUID = re.compile('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
SIDECOURT_ID = re.compile('SC[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}')
HANDLE = re.compile('[A-Za-z0-9_]{3,24}')
LABEL = re.compile('[a-z_]{1,32}')
COVER_BLOCKING_LABELS = ('cover_hidden', 'sensitive')
LLMS_BLOCKING_LABELS = ('agent_caution',)
WITHDRAWN_TEXT = 'This work isn’t available right now.'
CONNECT_DESCRIPTION = 'Connect ChatGPT, Claude, Claude Code or Codex to SideCourt. Save private drafts, edit your posts and choose what your AI can access. You decide what gets published.'
INDEXABLE_ROUTES = frozenset(['', 'drops', 'season', 'get-on', 'inside', 'guide', 'connect-ai', 'your-court/privacy', 'your-court/terms'])

# Character classes are spelled out (by code point) so Python and JavaScript agree on every input.
_CONTROL = re.compile('[' + chr(0) + '-' + chr(8) + chr(0x0e) + '-' + chr(0x1f) + chr(0x7f) + chr(0xd800) + '-' + chr(0xdfff) + ']')
_SPACE = re.compile('[' + ''.join(chr(c) for c in (9, 10, 11, 12, 13, 32, 0x85, 0xa0, 0x1680)) + chr(0x2000) + '-' + chr(0x200a)
                    + ''.join(chr(c) for c in (0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff)) + ']+')
_FLAGS = re.IGNORECASE | re.ASCII
_PAGE_TAGS = [
    re.compile(r'<title\b[^>]*>[\s\S]*?</title>\n?', _FLAGS),
    re.compile(r'<meta\b[^>]*\b(?:name|property)\s*=\s*["\'](?:description|author|robots|og:[^"\']*|twitter:[^"\']*)["\'][^>]*>\n?', _FLAGS),
    re.compile(r'<link\b[^>]*\brel\s*=\s*["\']canonical["\'][^>]*>\n?', _FLAGS),
]
_ROUTE_TAGS = [re.compile(r'<meta\b[^>]*\bname\s*=\s*["\']robots["\'][^>]*>\n?', _FLAGS), _PAGE_TAGS[2]]
_IMAGE = re.compile(r'https://[A-Za-z0-9.-]+(?::[0-9]{1,5})?(?:/[^\s"\'<>]*)?', _FLAGS)


def read_config(config_js):
    """window.SIDECOURT_CONFIG={...}; -> dict. Reads only what the public site already ships."""
    text = pathlib.Path(config_js).read_text(encoding='utf-8')
    return json.loads(text[text.index('{'):text.rindex('}') + 1])


def collapse(value):
    if not isinstance(value, str):
        return ''
    return _SPACE.sub(' ', _CONTROL.sub('', value)).strip(' ')


def esc(value):
    return collapse(value).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&#39;')


def normalize_sidecourt_id(value):
    candidate = collapse(value).upper()
    return candidate if SIDECOURT_ID.fullmatch(candidate) else ''


def site_base(site_url):
    return (collapse(site_url) or SITE).rstrip('/') + '/'


def summary(value, limit=DESCRIPTION_LIMIT):
    """First ~limit characters, whitespace collapsed, cut at a word when that keeps more than half."""
    whole = collapse(value)
    if len(whole) <= limit:
        return whole
    cut = whole[:limit]
    space = cut.rfind(' ')
    if space > limit // 2:
        cut = cut[:space]
    return cut.rstrip(' ,;:.-') + '…'


def head_block(head):
    title, description = head.get('title', ''), head.get('description', '')
    canonical, image, author, robots = head.get('canonical', ''), head.get('image', ''), head.get('author', ''), head.get('robots', '')
    block = '<title>' + esc(title) + '</title>\n<meta name="description" content="' + esc(description) + '">\n'
    if collapse(author):
        block += '<meta name="author" content="' + esc(author) + '">\n'
    if collapse(canonical):
        block += '<link rel="canonical" href="' + esc(canonical) + '">\n'
    if collapse(robots):
        block += '<meta name="robots" content="' + esc(robots) + '">\n'
    block += ('<meta property="og:type" content="' + esc(head.get('og_type') or 'website') + '">\n<meta property="og:site_name" content="SideCourt">\n'
              '<meta property="og:title" content="' + esc(title) + '">\n<meta property="og:description" content="' + esc(description) + '">\n')
    if collapse(canonical):
        block += '<meta property="og:url" content="' + esc(canonical) + '">\n'
    picture = preview_image(image, [])
    if picture:
        block += '<meta property="og:image" content="' + esc(picture) + '">\n'
    return block


def _replace_in_head(application, patterns, block):
    """Only <head> is touched: the page's own tags are removed and the new block goes right before </head>."""
    match = re.search(r'</head>', application, _FLAGS)
    if not match:
        raise ValueError('application index.html has no </head>')
    head = application[:match.start()]
    for pattern in patterns:
        head = pattern.sub('', head)
    return head + block + application[match.start():]


def inject_page_head(application, head):
    return _replace_in_head(application, _PAGE_TAGS, head_block(head))


def inject_head(application, title, description, canonical, og_type='website', image='', author='', review_site=False):
    """Earlier signature, kept for callers and tests of the previous helper."""
    return inject_page_head(application, {'title': title, 'description': description, 'canonical': canonical, 'og_type': og_type,
                                          'image': image, 'author': author, 'robots': 'noindex,nofollow' if review_site else ''})


def _robots_for(state, review_site):
    return 'noindex,nofollow' if review_site else '' if state == 'listed' else 'noindex'


def labels_of(row):
    labels = set()
    data = row.get('data') if isinstance(row.get('data'), dict) else {}
    for values in (row.get('labels'), data.get('labels')):
        if isinstance(values, list):
            for label in values:
                value = collapse(label).lower()
                if LABEL.fullmatch(value):
                    labels.add(value)
    if row.get('cover_hidden') is True:
        labels.add('cover_hidden')
    return sorted(labels)


def preview_image(cover, labels):
    """Covers are stored as data: URLs, which previews cannot use; only a hosted https picture is offered, never one a label hides."""
    if any(label in COVER_BLOCKING_LABELS for label in labels):
        return ''
    value = collapse(cover)
    return value if _IMAGE.fullmatch(value) else ''


def work_fields(row):
    """One shape for a sc_public_works row ({id, data, player...}) and a sc_public_post answer ({id, title, byline, author...})."""
    if not isinstance(row, dict) or not isinstance(row.get('id'), str) or not UUID.fullmatch(row['id']):
        return None
    data = row.get('data') if isinstance(row.get('data'), dict) else None
    if data is None and not isinstance(row.get('title'), str):
        return None
    player = row.get('player')
    if not isinstance(player, str):
        player = player.get('handle') if isinstance(player, dict) else None
        if player is None and data is None and isinstance(row.get('author'), dict):
            player = row['author'].get('handle')
    source = data if data is not None else row
    # The page text is the author's own description (Ming 2026-09-25: no separate card line).
    text = collapse(source.get('description'))
    return {
        'id': row['id'], 'sidecourt_id': normalize_sidecourt_id(row.get('sidecourt_id')),
        'name': collapse(data.get('name') if data is not None else row.get('title')),
        'author': collapse(data.get('author') if data is not None else row.get('byline')),
        'text': text, 'cover': source.get('cover') if isinstance(source.get('cover'), str) else '',
        'labels': labels_of(row), 'handle': player if isinstance(player, str) and HANDLE.fullmatch(player) else '',
        'limited': row.get('limited') is True,
    }


def _work_head(fields, url, state, review_site):
    robots = _robots_for(state, review_site)
    if state == 'limited':
        return {'title': 'SideCourt', 'description': 'A work on SideCourt.', 'canonical': url, 'og_type': 'website', 'robots': robots}
    return {'title': (fields['name'] or 'Untitled work') + ' · SideCourt', 'description': summary(fields['text']) or 'A work shared on SideCourt.',
            'author': fields['author'], 'canonical': url, 'og_type': 'article', 'image': preview_image(fields['cover'], fields['labels']), 'robots': robots}


def _withdrawn_head(review_site):
    return {'title': 'Not available · SideCourt', 'description': WITHDRAWN_TEXT, 'og_type': 'website', 'robots': _robots_for('withdrawn', review_site)}


def _person_head(handle, url, review_site):
    return {'title': '@' + handle + ' · SideCourt', 'description': 'Work by @' + handle + ' on SideCourt.', 'canonical': url, 'og_type': 'profile',
            'robots': _robots_for('listed', review_site)}


def _hidden_person_head(review_site):
    return {'title': 'SideCourt', 'description': 'A profile on SideCourt.', 'og_type': 'website', 'robots': _robots_for('withdrawn', review_site)}


def previous_identities(manifest=None, works=(), people=()):
    """Addresses an earlier build wrote, from its manifest and from the folders themselves, merged per work."""
    merged, handles = [], set()

    def add(work_id, sidecourt_id):
        work_id = work_id if isinstance(work_id, str) and UUID.fullmatch(work_id) else ''
        sidecourt_id = normalize_sidecourt_id(sidecourt_id)
        if not work_id and not sidecourt_id:
            return
        hits = [x for x in merged if (work_id and x['id'] == work_id) or (sidecourt_id and x['sidecourt_id'] == sidecourt_id)]
        into = hits[0] if hits else {'id': '', 'sidecourt_id': ''}
        for other in hits[1:]:
            into['id'] = into['id'] or other['id']
            into['sidecourt_id'] = into['sidecourt_id'] or other['sidecourt_id']
            merged.remove(other)
        into['id'] = into['id'] or work_id
        into['sidecourt_id'] = into['sidecourt_id'] or sidecourt_id
        if not hits:
            merged.append(into)

    manifest = manifest if isinstance(manifest, dict) else {}
    for entry in manifest.get('works') if isinstance(manifest.get('works'), list) else []:
        if isinstance(entry, dict):
            add(entry.get('id'), entry.get('sidecourt_id'))
    for address in works:
        if UUID.fullmatch(address):
            add(address, '')
        else:
            add('', address)
    for entry in manifest.get('people') if isinstance(manifest.get('people'), list) else []:
        if isinstance(entry, dict) and isinstance(entry.get('handle'), str) and HANDLE.fullmatch(entry['handle']):
            handles.add(entry['handle'])
    for handle in people:
        if HANDLE.fullmatch(handle):
            handles.add(handle)
    return {'works': sorted(merged, key=lambda x: x['id'] or x['sidecourt_id']), 'people': sorted(handles)}


def lookup_key(identity):
    return 'id:' + identity['id'] if identity['id'] else 'sid:' + identity['sidecourt_id']


def plan_public_pages(works=(), previous=None, lookup=None, site_url=SITE, review_site=False, complete=True):
    """The whole plan, without any I/O. works: sc_public_works rows (discoverable only). lookup: lookup_key -> the
    sc_public_post answer (None when not public). complete=False means the public list could not be read: nothing is
    planned and whatever the output already has is left as it is."""
    previous = previous or {'works': [], 'people': []}
    lookup = lookup or {}
    base = site_base(site_url)
    pages, sitemap, llms = [], [], []
    manifest = {'version': 1, 'site': base, 'complete': bool(complete), 'works': [], 'people': []}
    if not complete:
        return {'pages': pages, 'manifest': manifest, 'sitemap': sitemap, 'llms': llms}
    taken, people = set(), []
    for row in works if isinstance(works, list) else []:
        fields = work_fields(row)
        if not fields or not isinstance(row.get('data'), dict) or fields['id'] in taken or (fields['sidecourt_id'] and fields['sidecourt_id'] in taken):
            continue
        url = base + 'work/' + (fields['sidecourt_id'] or fields['id']) + '/'
        head = _work_head(fields, url, 'listed', review_site)
        for address in dict.fromkeys(a for a in (fields['id'], fields['sidecourt_id']) if a):
            taken.add(address)
            pages.append({'path': 'work/' + address, 'kind': 'work', 'state': 'listed', 'head': head})
        manifest['works'].append({'id': fields['id'], 'sidecourt_id': fields['sidecourt_id'] or None, 'state': 'listed', 'url': url,
                                  'name': fields['name'], 'labels': fields['labels']})
        sitemap.append(url)
        if not any(label in LLMS_BLOCKING_LABELS for label in fields['labels']):
            llms.append({'name': fields['name'] or 'Untitled work', 'url': url})
        if fields['handle'] and fields['handle'] not in people:
            people.append(fields['handle'])
    for identity in previous.get('works') or []:
        if (identity['id'] and identity['id'] in taken) or (identity['sidecourt_id'] and identity['sidecourt_id'] in taken):
            continue
        fields = work_fields(lookup.get(lookup_key(identity)))
        same = bool(fields) and (not identity['id'] or fields['id'] == identity['id']) and (
            not identity['sidecourt_id'] or not fields['sidecourt_id'] or fields['sidecourt_id'] == identity['sidecourt_id'])
        candidates = [identity['id'], identity['sidecourt_id'], fields['id'] if same else '', fields['sidecourt_id'] if same else '']
        addresses = [a for a in dict.fromkeys(c for c in candidates if c) if a not in taken]
        if same:
            state = 'limited' if fields['limited'] else 'unlisted'
            url = base + 'work/' + (fields['sidecourt_id'] or fields['id']) + '/'
            head = _work_head(fields, url, state, review_site)
            for address in addresses:
                taken.add(address)
                pages.append({'path': 'work/' + address, 'kind': 'work', 'state': state, 'head': head})
            manifest['works'].append({'id': fields['id'], 'sidecourt_id': fields['sidecourt_id'] or None, 'state': state, 'url': url})
        else:
            head = _withdrawn_head(review_site)
            for address in addresses:
                taken.add(address)
                pages.append({'path': 'work/' + address, 'kind': 'work', 'state': 'withdrawn', 'head': head})
            manifest['works'].append({'id': identity['id'] or None, 'sidecourt_id': identity['sidecourt_id'] or None, 'state': 'withdrawn'})
    for handle in people:
        url = base + 'people/' + handle + '/'
        pages.append({'path': 'people/' + handle, 'kind': 'person', 'state': 'listed', 'head': _person_head(handle, url, review_site)})
        manifest['people'].append({'handle': handle, 'state': 'listed', 'url': url})
    for handle in previous.get('people') or []:
        if handle in people:
            continue
        pages.append({'path': 'people/' + handle, 'kind': 'person', 'state': 'withdrawn', 'head': _hidden_person_head(review_site)})
        manifest['people'].append({'handle': handle, 'state': 'withdrawn'})
    return {'pages': pages, 'manifest': manifest, 'sitemap': sitemap, 'llms': llms}


def render_pages(application, plan):
    return [{'path': page['path'], 'state': page['state'], 'html': inject_page_head(application, page['head'])} for page in plan['pages']]


def manifest_json(manifest):
    return json.dumps(manifest, indent=1, ensure_ascii=False) + '\n'


def collect_public_pages(rpc, previous=None, limit=200, warn=lambda message: None):
    """Reads the public list, then asks once per earlier page that is no longer listed. rpc(name, args) -> parsed JSON."""
    previous = previous or {'works': [], 'people': []}
    try:
        works = rpc('sc_public_works', {})
        if not isinstance(works, list):
            raise RuntimeError('unexpected answer')
    except Exception as error:  # noqa: BLE001 - any failure means "not read"
        return {'complete': False, 'error': str(error), 'works': [], 'lookup': {}}
    listed = set()
    for row in works:
        fields = work_fields(row)
        if fields:
            listed.add(fields['id'])
            if fields['sidecourt_id']:
                listed.add(fields['sidecourt_id'])
    lookup, asked = {}, 0
    for identity in previous.get('works') or []:
        if (identity['id'] and identity['id'] in listed) or (identity['sidecourt_id'] and identity['sidecourt_id'] in listed):
            continue
        if asked >= limit:
            warn('More than ' + str(limit) + ' earlier pages to check; the rest get the placeholder.')
            break
        asked += 1
        try:
            if identity['id']:
                lookup[lookup_key(identity)] = rpc('sc_public_post', {'work_id': identity['id']})
            else:
                lookup[lookup_key(identity)] = rpc('sc_public_post_by_id', {'sidecourt_id': identity['sidecourt_id']})
        except Exception as error:  # noqa: BLE001
            warn('Could not check ' + (identity['sidecourt_id'] or identity['id']) + ' (' + str(error) + '); it gets the placeholder.')
            lookup[lookup_key(identity)] = None
    return {'complete': True, 'works': works, 'lookup': lookup}


def rest_rpc(config, timeout=20):
    """The same anonymous public reads the website performs, with the publishable key it ships."""
    url, key = (config.get('supabaseUrl') or '').rstrip('/'), config.get('publishableKey') or ''
    if not url or not key:
        raise RuntimeError('config.js has no Supabase project')

    def call(name, args):
        request = urllib.request.Request(url + '/rest/v1/rpc/' + name, data=json.dumps(args).encode('utf-8'), method='POST', headers={
            'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Accept': 'application/json'})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            if response.status != 200:
                raise RuntimeError('HTTP ' + str(response.status))
            return json.loads(response.read().decode('utf-8'))
    return call


def fetch_public_works(config, timeout=20):
    """Earlier helper, kept: the discoverable list only. Raises on any failure; the caller decides."""
    works = rest_rpc(config, timeout)('sc_public_works', {})
    if not isinstance(works, list):
        raise RuntimeError('unexpected response shape')
    return works


def scan_previous(folder):
    """public-pages.json and the work/people folders an earlier build or the committed overlay left in folder."""
    folder = pathlib.Path(folder)
    found = {'manifest': None, 'works': [], 'people': []}
    try:
        found['manifest'] = json.loads((folder / 'public-pages.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        pass
    for sub, key, valid in (('work', 'works', lambda n: UUID.fullmatch(n) or SIDECOURT_ID.fullmatch(n)), ('people', 'people', HANDLE.fullmatch)):
        root = folder / sub
        if root.is_dir():
            for entry in sorted(root.iterdir()):
                if entry.is_dir() and valid(entry.name) and (entry / 'index.html').is_file():
                    found[key].append(entry.name)
    return found


def write_pages(out, application, plan):
    out = pathlib.Path(out)
    for page in render_pages(application, plan):
        target = out / page['path']
        target.mkdir(parents=True, exist_ok=True)
        (target / 'index.html').write_text(page['html'], encoding='utf-8')
    (out / 'public-pages.json').write_text(manifest_json(plan['manifest']), encoding='utf-8')


def publish_site_pages(out, application, config, rpc=None, warn=print):
    """Production build step: connect-ai page, every public work and people page, placeholders for pages that are no
    longer public, and public-pages.json, all in out (which already holds the committed overlay). Returns the plan
    (plan['sitemap'] and plan['llms'] for the caller). When the public list cannot be read nothing is rewritten: the
    committed overlay's pages stay, and the sitemap and llms.txt entries come from its public-pages.json."""
    out = pathlib.Path(out)
    config = config or {}
    site, review = config.get('siteUrl') or SITE, bool(config.get('reviewSite'))
    publish_connection_page(out, application, config)
    found = scan_previous(out)
    previous = previous_identities(found['manifest'], found['works'], found['people'])
    if rpc is None:
        try:
            rpc = rest_rpc(config)
        except RuntimeError as error:
            message = str(error)

            def rpc(name, args):
                raise RuntimeError(message)
    collected = collect_public_pages(rpc, previous, warn=warn)
    plan = plan_public_pages(collected['works'], previous, collected['lookup'], site, review, collected['complete'])
    if not collected['complete']:
        warn('public works were not read (' + collected.get('error', '')[:120] + '); the committed pages stay as they are until the next build.')
        committed = found['manifest'] if isinstance(found['manifest'], dict) else {}
        for entry in committed.get('works') if isinstance(committed.get('works'), list) else []:
            if isinstance(entry, dict) and entry.get('state') == 'listed' and isinstance(entry.get('url'), str) and entry['url'].startswith(site_base(site)):
                plan['sitemap'].append(entry['url'])
                labels = entry.get('labels') if isinstance(entry.get('labels'), list) else []
                if not any(label in LLMS_BLOCKING_LABELS for label in labels):
                    plan['llms'].append({'name': collapse(entry.get('name')) or 'Untitled work', 'url': entry['url']})
        return plan
    write_pages(out, application, plan)
    return plan


def public_pages(works, site_url=SITE):
    """Earlier helper, kept: [(folder, title, description, canonical, og_type, image)] for the listed pages."""
    return [(page['path'], page['head']['title'], page['head']['description'], page['head'].get('canonical', ''), page['head']['og_type'],
             page['head'].get('image', '')) for page in plan_public_pages(works, None, None, site_url)['pages']]


def publish_public_pages(out, application, works, config=None):
    """Earlier entry point, kept: writes the connect-ai page and the listed pages only. Returns public_pages() tuples."""
    if config is None:
        config_file = pathlib.Path(out) / 'config.js'
        config = read_config(config_file) if config_file.is_file() else {}
    publish_connection_page(out, application, config)
    plan = plan_public_pages(works, None, None, config.get('siteUrl') or SITE, bool(config.get('reviewSite')))
    for page in render_pages(application, plan):
        target = pathlib.Path(out) / page['path']
        target.mkdir(parents=True, exist_ok=True)
        (target / 'index.html').write_text(page['html'], encoding='utf-8')
    return [(page['path'], page['head']['title'], page['head']['description'], page['head'].get('canonical', ''), page['head']['og_type'],
             page['head'].get('image', '')) for page in plan['pages']]


def connection_page_html(application, config=None):
    config = config or {}
    return inject_page_head(application, {'title': 'Connect your AI · SideCourt', 'description': CONNECT_DESCRIPTION,
                                          'canonical': site_base(config.get('siteUrl') or SITE) + 'connect-ai/', 'og_type': 'website',
                                          'robots': 'noindex,nofollow' if config.get('reviewSite') else ''})


def publish_connection_page(out, application, config=None):
    """Give the public setup guide its own head even when the public-work read is empty."""
    target = pathlib.Path(out) / 'connect-ai'
    target.mkdir(parents=True, exist_ok=True)
    target.joinpath('index.html').write_text(connection_page_html(application, config), encoding='utf-8')


def route_page_html(application, route, config=None):
    """Fixed application routes: own final address as canonical; routes that are not content are noindex."""
    config = config or {}
    if route == 'connect-ai':
        return connection_page_html(application, config)
    review = bool(config.get('reviewSite'))
    robots = 'noindex,nofollow' if review else '' if route in INDEXABLE_ROUTES else 'noindex'
    block = '<link rel="canonical" href="' + esc(site_base(config.get('siteUrl') or SITE) + (route + '/' if route else '')) + '">\n'
    return _replace_in_head(application, _ROUTE_TAGS, block + ('<meta name="robots" content="' + robots + '">\n' if robots else ''))


def not_found_html(application, config=None):
    review = bool((config or {}).get('reviewSite'))
    return _replace_in_head(application, _ROUTE_TAGS, '<meta name="robots" content="' + ('noindex,nofollow' if review else 'noindex') + '">\n')


def sitemap_xml(urls):
    body = ''.join('<url><loc>' + esc(url) + '</loc></url>' for url in dict.fromkeys(urls))
    return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + body + '</urlset>'


def llms_text(template, entries):
    """Works are listed by name and address only: their descriptions are the makers' words, and this file is read by AI
    answer engines, so no maker text beyond the title goes in."""
    lines = ['- [' + summary(entry['name'], 100).replace('[', '(').replace(']', ')') + '](' + entry['url'] + ')' for entry in entries]
    intro = (template if isinstance(template, str) else '').rstrip(' \t\n\r')
    if not lines:
        return intro + '\n'
    return intro + '\n\n## Works\n\nPublished by their makers. Each page is the maker’s own words, not SideCourt’s.\n\n' + '\n'.join(lines) + '\n'
