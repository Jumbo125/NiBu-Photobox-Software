# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 Andreas Rottmann
"""
webapi — Portierung der ehemaligen PHP-API (booth/api/*.php) nach Python.

Wird von python_server.py importiert und in do_GET/do_POST eingehaengt.
Siehe routes.py fuer die einzelnen Endpunkte und multipart.py fuer das
Parsen von multipart/form-data Uploads (ZIP/Bild-Uploads).
"""
