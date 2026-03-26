# Fund Factsheets
Place fund factsheet PDFs here for ChromaDB RAG indexing.
These are used by the Advisory Agent for contextual recommendations.

Current analytics bootstrap file:
- `factsheet_reference.json`: static metadata used by `AnalyticsAgent` for
	expense ratios, direct-plan comparison, and top holdings overlap until
	full ChromaDB factsheet ingestion is wired.

Optional full RAG indexing module:
- `utils/rag_indexer.py` provides ChromaDB indexing/query for factsheet PDFs.
- Heavy deps are optional: `chromadb`, `sentence-transformers`.
- If not installed, code degrades gracefully and static loader remains active.
