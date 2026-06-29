from __future__ import annotations
from typing import Tuple


def parse_row(row: dict) -> Tuple[str, str, str]:
    """Extrait (catégorie, texte_erroné, référence) depuis une ligne du dataset."""
    category, erroneous = row["input"].split(": ", 1)
    return category.strip(), erroneous.strip(), row["target"].strip()
