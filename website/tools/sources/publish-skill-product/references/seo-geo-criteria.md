# SEO/GEO criteria for individual skill products

Use this reference when writing or auditing a public product page. The rules deliberately separate
supported practices from experiments and folklore.

## Supported baseline

1. **Make the page crawlable and indexable.** Generative search still depends on ordinary search
   discovery and retrieval. A new public URL is eligible, not guaranteed to be indexed or shown.
2. **Give each skill one independent URL and primary intent.** Use a problem-led title, accurate
   description, focused repository topics, and a direct install path.
3. **Publish non-commodity content.** Preserve the real incident, constraint, rejected default, or
   field evidence that caused the skill to exist. A generic list of tips is weaker than a concrete
   first-hand method.
4. **Make evidence extractable.** Use descriptive headings, concise definitions, numbered steps,
   explicit comparisons, examples, and clearly labeled test results. Cite primary sources for
   outside factual claims.
5. **Keep visible content and metadata consistent.** Do not promise a capability in the repository
   description that the README and `SKILL.md` do not implement.
6. **Maintain the product.** Broken install commands, missing referenced files, stale sibling links,
   and contradictory versions damage both users and retrieval systems.

## Platform-specific checks

### GitHub

- Root README explains why the product is useful, what it does, and how to use it.
- Repository description states the problem and outcome in plain language.
- Topics describe purpose, subject, ecosystem, and compatibility; keep them focused.
- License is explicit.
- Social preview is useful when one can be created without delaying release; do not treat it as a
  ranking guarantee.

### OpenAI search

On a domain the owner controls, allow `OAI-SearchBot` if appearing in OpenAI search results is
desired. Its control is independent from `GPTBot`, which concerns model-training crawl. GitHub.com
crawler policy is controlled by GitHub, not by an individual repository owner.

### Google generative search

Continue normal SEO. Google states that no special generative-search schema is required and warns
against rewriting solely for AI, manufacturing mentions, and overfocusing on structured data.
Structured data may still support ordinary rich-result eligibility when it matches visible content.

### IndexNow

Use IndexNow only on a host the owner can verify with a key file. It can notify participating search
engines that owned URLs were added, updated, or deleted; receipt is not an indexing guarantee. Do
not attempt to submit `github.com` URLs as if the repository owner controlled that host.

## Experimental, optional, or unsupported claims

- `llms.txt` is not required for Google generative search. Add it only when a specific consumer and
  maintenance owner justify it; do not call it an SEO requirement.
- FAQ sections help only when they answer real user questions. Do not manufacture questions to
  cover keyword variants.
- Academic GEO experiments suggest that structured, semantically aligned pages with concrete
  evidence, citations, statistics, or relevant quotations can be more visible or influential in
  generated answers. Apply this by improving truthful evidence, never by adding decorative numbers
  or irrelevant quotes.
- No tool can promise a ranking, citation, or index date. Record observations and trends instead.

## Primary references

- Google, "Optimizing your website for generative AI features on Google Search":
  https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- Google, "Guidance on generative AI content":
  https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
- OpenAI, "Overview of OpenAI Crawlers":
  https://developers.openai.com/api/docs/bots
- GitHub, "Customizing your repository":
  https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository
- IndexNow documentation: https://www.indexnow.org/documentation
- Aggarwal et al., "GEO: Generative Engine Optimization":
  https://arxiv.org/abs/2311.09735
