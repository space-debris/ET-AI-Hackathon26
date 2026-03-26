"""
FinSage AI - RAG Indexer (Abhishek)
===================================
ChromaDB-based vector indexer for fund factsheet PDFs.

Indexes factsheet PDFs into a ChromaDB collection for retrieval-augmented
generation (RAG). When chromadb / sentence-transformers are not installed,
the module degrades gracefully - callers can check is_available() and fall
back to utils/factsheet_loader.py.

Optional dependencies (heavy):
    pip install chromadb sentence-transformers
"""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from shared.config import (
    CHROMA_COLLECTION_NAME,
    CHROMA_PERSIST_DIR,
    EMBEDDING_MODEL,
    FUND_FACTSHEETS_DIR,
    RAG_TOP_K,
)

logger = logging.getLogger(__name__)


_chromadb = None
_SentenceTransformer = None
_AVAILABLE: Optional[bool] = None


def _try_imports() -> bool:
    """Attempt to import optional RAG dependencies once."""
    global _chromadb, _SentenceTransformer, _AVAILABLE
    if _AVAILABLE is not None:
        return _AVAILABLE

    try:
        import chromadb as _chroma_mod  # type: ignore
        from sentence_transformers import SentenceTransformer as _st  # type: ignore

        _chromadb = _chroma_mod
        _SentenceTransformer = _st
        _AVAILABLE = True
    except ImportError:
        _AVAILABLE = False
        logger.info(
            "chromadb or sentence-transformers not installed; RAG disabled. "
            "Using static factsheet loader fallback."
        )
    return _AVAILABLE


def is_available() -> bool:
    """Return True if RAG dependencies are installed."""
    return _try_imports()


def _extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text from a PDF using pdfplumber."""
    try:
        import pdfplumber  # type: ignore
    except ImportError:
        logger.warning("pdfplumber missing; cannot extract text from %s", pdf_path)
        return ""

    chunks: List[str] = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                if text.strip():
                    chunks.append(text)
    except Exception as exc:
        logger.warning("Failed to extract text from %s: %s", pdf_path, exc)
    return "\n".join(chunks)


def _chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    """Split text into overlapping chunks for embeddings."""
    if not text.strip():
        return []

    # Prevent accidental infinite loop if overlap >= chunk_size.
    overlap = min(max(overlap, 0), chunk_size - 1)

    words = text.split()
    out: List[str] = []
    start = 0
    step = chunk_size - overlap
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk = " ".join(words[start:end])
        if chunk.strip():
            out.append(chunk)
        start += step
    return out


def _extract_metadata_from_text(text: str, filename: str) -> Dict[str, str]:
    """Extract lightweight metadata from a factsheet text body."""
    metadata: Dict[str, str] = {"source_file": filename}

    for pattern in [
        r"(?:scheme|fund)\s*(?:name)?\s*[:\-]\s*(.+)",
        r"^(.+?(?:fund|scheme).+?)$",
    ]:
        match = re.search(pattern, text[:2000], re.IGNORECASE | re.MULTILINE)
        if match:
            metadata["scheme_name"] = match.group(1).strip()[:200]
            break

    amc_match = re.search(
        r"(?:amc|asset\s+management)\s*[:\-]\s*(.+)", text[:2000], re.IGNORECASE
    )
    if amc_match:
        metadata["amc"] = amc_match.group(1).strip()[:100]

    return metadata


class FactsheetRAGIndexer:
    """Indexes and queries factsheet data in a persistent ChromaDB collection."""

    def __init__(
        self,
        persist_dir: str = CHROMA_PERSIST_DIR,
        collection_name: str = CHROMA_COLLECTION_NAME,
        factsheets_dir: str = FUND_FACTSHEETS_DIR,
    ) -> None:
        if not is_available():
            raise RuntimeError(
                "ChromaDB RAG unavailable. Install with: pip install chromadb sentence-transformers"
            )

        self._persist_dir = persist_dir
        self._collection_name = collection_name
        self._factsheets_dir = factsheets_dir

        self._client = _chromadb.PersistentClient(path=self._persist_dir)
        self._embedder = _SentenceTransformer(EMBEDDING_MODEL)
        self._collection = self._client.get_or_create_collection(
            name=self._collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def index_factsheets(self, force_reindex: bool = False) -> int:
        """Index all factsheet PDFs plus factsheet_reference.json."""
        if force_reindex:
            try:
                self._client.delete_collection(self._collection_name)
            except Exception:
                pass
            self._collection = self._client.get_or_create_collection(
                name=self._collection_name,
                metadata={"hnsw:space": "cosine"},
            )

        factsheets_path = Path(self._factsheets_dir)
        if not factsheets_path.exists():
            logger.warning("Factsheets directory not found: %s", self._factsheets_dir)
            return 0

        total = 0
        for pdf_file in factsheets_path.glob("*.pdf"):
            total += self._index_pdf(str(pdf_file))

        json_ref = factsheets_path / "factsheet_reference.json"
        if json_ref.exists():
            total += self._index_json_reference(str(json_ref))

        logger.info("Indexed %d chunks into ChromaDB", total)
        return total

    def _index_pdf(self, pdf_path: str) -> int:
        filename = os.path.basename(pdf_path)

        existing = self._collection.get(where={"source_file": filename})
        if existing and existing.get("ids"):
            return 0

        text = _extract_text_from_pdf(pdf_path)
        chunks = _chunk_text(text)
        if not chunks:
            return 0

        metadata = _extract_metadata_from_text(text, filename)
        ids = [f"{filename}_chunk_{i}" for i in range(len(chunks))]
        embeddings = self._embedder.encode(chunks).tolist()
        metadatas = [metadata.copy() for _ in chunks]

        self._collection.add(
            ids=ids,
            documents=chunks,
            embeddings=embeddings,
            metadatas=metadatas,
        )
        return len(chunks)

    def _index_json_reference(self, json_path: str) -> int:
        filename = os.path.basename(json_path)
        existing = self._collection.get(where={"source_file": filename})
        if existing and existing.get("ids"):
            return 0

        try:
            data = json.loads(Path(json_path).read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Failed to read %s: %s", json_path, exc)
            return 0

        chunks: List[str] = []
        metadatas: List[Dict[str, str]] = []

        for fund in data.get("funds", []):
            parts = [
                f"Scheme: {fund.get('scheme', 'Unknown')}",
                f"ISIN: {fund.get('isin', 'N/A')}",
                f"AMC: {fund.get('amc', 'N/A')}",
                f"Category: {fund.get('category', 'N/A')}",
                f"Expense Ratio: {fund.get('expense_ratio', 'N/A')}%",
                f"Direct Expense Ratio: {fund.get('direct_expense_ratio', 'N/A')}%",
            ]

            holdings = fund.get("top_holdings", [])
            if holdings:
                lines = [
                    f"  {h.get('stock_name', '')}: {h.get('weight', 0) * 100:.1f}% ({h.get('sector', 'N/A')})"
                    for h in holdings
                ]
                parts.append("Top Holdings:\n" + "\n".join(lines))

            chunks.append("\n".join(parts))
            metadatas.append(
                {
                    "source_file": filename,
                    "scheme_name": str(fund.get("scheme", "")),
                    "amc": str(fund.get("amc", "")),
                    "isin": str(fund.get("isin", "")),
                }
            )

        if not chunks:
            return 0

        ids = [f"{filename}_fund_{i}" for i in range(len(chunks))]
        embeddings = self._embedder.encode(chunks).tolist()

        self._collection.add(
            ids=ids,
            documents=chunks,
            embeddings=embeddings,
            metadatas=metadatas,
        )
        return len(chunks)

    def query(
        self,
        query_text: str,
        top_k: int = RAG_TOP_K,
        filter_metadata: Optional[Dict[str, str]] = None,
    ) -> List[Dict[str, Any]]:
        """Query the factsheet vector store."""
        count = int(self._collection.count() or 0)
        if count <= 0:
            return []

        query_embedding = self._embedder.encode([query_text]).tolist()
        kwargs: Dict[str, Any] = {
            "query_embeddings": query_embedding,
            "n_results": min(top_k, count),
        }
        if filter_metadata:
            kwargs["where"] = filter_metadata

        results = self._collection.query(**kwargs)

        out: List[Dict[str, Any]] = []
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        for doc, meta, dist in zip(documents, metadatas, distances):
            out.append({
                "document": doc,
                "metadata": meta,
                "distance": dist,
            })
        return out

    def query_fund_info(self, fund_name: str, isin: Optional[str] = None) -> Optional[str]:
        """Return top matching factsheet chunk for a given fund."""
        query = fund_name
        if isin:
            query += f" ISIN {isin}"

        results = self.query(query, top_k=1)
        if results:
            return results[0]["document"]
        return None

    @property
    def collection_count(self) -> int:
        """Number of chunks currently stored."""
        return int(self._collection.count() or 0)


def index_all_factsheets(force_reindex: bool = False) -> int:
    """One-shot helper for indexing all factsheets."""
    if not is_available():
        logger.info("RAG not available; skipping indexing.")
        return 0

    indexer = FactsheetRAGIndexer()
    return indexer.index_factsheets(force_reindex=force_reindex)


def query_factsheets(query: str, top_k: int = RAG_TOP_K) -> List[Dict[str, Any]]:
    """One-shot helper for querying factsheets."""
    if not is_available():
        return []

    indexer = FactsheetRAGIndexer()
    return indexer.query(query, top_k=top_k)
