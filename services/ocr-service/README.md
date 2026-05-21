# OCR Service

Async OCR processing service.

Architecture:
Upload -> Queue -> Worker -> OCR Engine

Stack:
- PaddleOCR
- OpenCV
- Sharp
