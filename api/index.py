"""Vercel entry point: exposes the FastAPI app. The static UI is served by Vercel from web/out."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from medinotes.app import app  # noqa: E402, F401
