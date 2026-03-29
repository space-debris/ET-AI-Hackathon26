# Form 16 Knowledge Pack

This folder contains bundled knowledge documents used by the Life Event Advisor
chat assistant.

- `sample_form16_fy2025_26.md` contains a synthetic but realistic salary Form 16
  fixture grounded in the same numbers used across the tax demo.
- `life_event_form16_playbook.md` contains retrieval-ready notes for how salary
  documents should be checked during bonus, job-switch, marriage, new-baby, and
  inheritance scenarios.

These files are chunked and retrieved locally by the lightweight RAG pipeline in
`agents/life_event_agent.py`.
