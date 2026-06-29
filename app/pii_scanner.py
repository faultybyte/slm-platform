"""
Lightweight regex-based PII scanner.
Used by the API proxy to gate requests before they reach the inference engine.
"""
import re
from typing import NamedTuple


class ScanResult(NamedTuple):
    is_safe: bool
    detected: list[str]


_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("email",
     re.compile(r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b')),
    ("phone_number",
     re.compile(r'\b(?:\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}\b')),
    ("ssn",
     re.compile(r'\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b')),
    ("credit_card",
     re.compile(r'\b(?:4[0-9]{12}(?:[0-9]{3})?'          # Visa
                r'|5[1-5][0-9]{14}'                        # MasterCard
                r'|3[47][0-9]{13}'                         # Amex
                r'|6(?:011|5[0-9]{2})[0-9]{12})\b')),      # Discover
    ("ip_address",
     re.compile(
         r'\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}'
         r'(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b'
     )),
]


def _scan_text(text: str) -> list[str]:
    found: list[str] = []
    for name, pattern in _PATTERNS:
        if pattern.search(text):
            found.append(name)
    return found


def scan_messages(messages: list[dict]) -> ScanResult:
    """
    Scans every content field in a list of chat messages.
    Returns ScanResult(is_safe=True) when no PII is found.
    """
    all_found: list[str] = []
    for msg in messages:
        content = msg.get("content", "")
        if isinstance(content, str):
            all_found.extend(_scan_text(content))
        elif isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and part.get("type") == "text":
                    all_found.extend(_scan_text(part.get("text", "")))
    unique = list(dict.fromkeys(all_found))
    return ScanResult(is_safe=len(unique) == 0, detected=unique)
