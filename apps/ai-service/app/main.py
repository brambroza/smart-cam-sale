import base64
import os
import time
from typing import List, Optional

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

USE_MOCK = os.getenv("USE_MOCK", "false").lower() == "true"
MODEL_NAME = os.getenv("MODEL_NAME", "buffalo_l")

app = FastAPI(title="Smart Cam AI Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    image: str = Field(..., description="Base64-encoded JPEG/PNG, may include data URI prefix")


class Bbox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class Face(BaseModel):
    bbox: Bbox
    embedding: List[float]
    age: int
    gender: str
    det_score: float


class AnalyzeResponse(BaseModel):
    faces: List[Face]
    processing_ms: int


_model = None


def _get_model():
    global _model
    if _model is not None:
        return _model
    if USE_MOCK:
        return None
    from insightface.app import FaceAnalysis  # type: ignore

    fa = FaceAnalysis(name=MODEL_NAME, providers=["CPUExecutionProvider"])
    fa.prepare(ctx_id=0, det_size=(640, 640))
    _model = fa
    return fa


def _decode_image(b64: str) -> np.ndarray:
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    raw = base64.b64decode(b64)
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(400, "Invalid image data")
    return img


def _mock_faces(img: np.ndarray) -> List[Face]:
    h, w = img.shape[:2]
    rng = np.random.default_rng(seed=int(img.mean()))
    return [
        Face(
            bbox=Bbox(x=w * 0.3, y=h * 0.2, width=w * 0.4, height=h * 0.55),
            embedding=rng.standard_normal(512).tolist(),
            age=int(rng.integers(18, 55)),
            gender="male" if rng.random() > 0.5 else "female",
            det_score=0.92,
        )
    ]


@app.get("/health")
def health():
    return {"status": "ok", "mock": USE_MOCK, "model": MODEL_NAME}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    started = time.perf_counter()
    img = _decode_image(req.image)

    if USE_MOCK:
        faces = _mock_faces(img)
    else:
        model = _get_model()
        detected = model.get(img)  # type: ignore
        faces = []
        for f in detected:
            bx1, by1, bx2, by2 = [float(v) for v in f.bbox]
            gender_val = "male" if int(f.gender) == 1 else "female"
            faces.append(
                Face(
                    bbox=Bbox(x=bx1, y=by1, width=bx2 - bx1, height=by2 - by1),
                    embedding=f.normed_embedding.tolist(),
                    age=int(f.age),
                    gender=gender_val,
                    det_score=float(f.det_score),
                )
            )

    return AnalyzeResponse(
        faces=faces,
        processing_ms=int((time.perf_counter() - started) * 1000),
    )
