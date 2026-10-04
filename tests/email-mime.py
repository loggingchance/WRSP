"""Inspect actual generated email bytes, including the attached PDF."""
import sys
import json
from email import policy
from email.parser import BytesParser
from io import BytesIO
from pathlib import Path

from pypdf import PdfReader

folder = Path(sys.argv[1])
message = BytesParser(policy=policy.default).parsebytes((folder / "plan.eml").read_bytes())
assert str(message["Subject"]) == "Maple Ridge Test Harvest - DEMONSTRATION ONLY"
for case in json.loads((folder / "subjects.json").read_text(encoding="utf-8")):
    draft = BytesParser(policy=policy.default).parsebytes(case["eml"].encode("utf-8"))
    assert str(draft["Subject"]) == case["expected"], "Plan name must round-trip as the email subject"
    assert len(draft.get_all("Subject")) == 1
assert message.get_content_type() == "multipart/mixed"
alternative = next(part for part in message.walk() if part.get_content_type() == "multipart/alternative")
assert [part.get_content_type() for part in alternative.iter_parts()] == ["text/plain", "text/html"]
plain = message.get_body(preferencelist=("plain",)).get_content()
html = message.get_body(preferencelist=("html",)).get_content()
assert "Directions from known intersection" in plain
assert "Directions for Responders" in html
assert 'href="https://www.google.com/maps?q=44.1486,-72.6408"' in html
assert 'href="tel:911"' in html
attachments = list(message.iter_attachments())
assert len(attachments) == 1 and attachments[0].get_content_type() == "application/pdf"
pdf_bytes = attachments[0].get_payload(decode=True)
assert pdf_bytes == (folder / "plan.pdf").read_bytes()
pdf = PdfReader(BytesIO(pdf_bytes), strict=True)
assert len(pdf.pages) == 1
uris = [str(annotation.get_object()["/A"]["/URI"]) for annotation in pdf.pages[0]["/Annots"]]
assert "https://www.google.com/maps?q=44.1486,-72.6408" in uris
assert "https://wrsp.lumbermen.org/" in uris
print("MIME: exact plan-name subjects including Unicode/long names, HTML/plain-text bodies, identical one-page PDF with site and footer links.")
