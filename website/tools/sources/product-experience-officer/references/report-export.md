# Evidence-led report export

Use `examples/report.json` as an input shape, not as real findings. Keep the raw
experience log before diagnosis; identify the actual mode and reviewer type. An author
who knows the implementation uses `context_aware`. An independent agent must really
be independent and authorized; a changed label is not independence.

Record a concrete task and result (`passed`, `failed`, `not_tested`) with its actual
evidence. Include a recovery path and remaining verification. Each finding needs a
supported severity (`blocker`, `major`, `minor`, `polish`), observed behavior, evidence,
user impact, a specific recommended fix, effort (`S`, `M`, `L`), and a retest.
Zero findings is valid; state the bounded tested scope and unknowns. Do not invent issues.

Run `python3 <skill-dir>/scripts/report.py --input PROJECT/review.json --out NEW_FILE.html`.
The renderer validates these fields, escapes supplied text, sorts findings and writes
one self-contained HTML file. It refuses to overwrite a report. It performs no browser
inspection, human recruitment, severity adjudication, repair, or truth verification.
Keep private screenshots and customer details in the project; get the appropriate
sharing authority before sending a client report. No automatic uploads occur.
