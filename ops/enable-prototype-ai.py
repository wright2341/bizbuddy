#!/usr/bin/env python3
"""Opt existing test accounts into managed AI without resetting monthly usage."""
from pathlib import Path
import json
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
import main  # noqa: E402

if __name__ == '__main__':
    print(json.dumps(main.enable_prototype_managed_ai()))
