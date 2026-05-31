import os
import base64
import sqlite3
import hashlib
from datetime import date

from openai import OpenAI
from dotenv import load_dotenv
import gradio as gr

load_dotenv()

ACCESS_PASSWORD = "0001"
DAILY_LIMIT = 3
DB_PATH = "usage.db"

api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY가 없습니다.")

client = OpenAI(api_key=api_key)

PROMPT = """
Transform only the human face areas.
Keep body, clothes, hairstyle, background, pose, lighting, and composition unchanged.
Change each face into a different natural face.
Keep the same age impression, gender impression, expression, and realistic skin texture.
Photorealistic result. No cartoon, no AI-art look.
The purpose is privacy protection for public promotional photos.
"""

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS usage (
            user_id TEXT,
            day TEXT,
            count INTEGER,
            PRIMARY KEY (user_id, day)
        )
    """)
    conn.commit()
    conn.close()

def get_user_id(request: gr.Request):
    ip = request.client.host if request and request.client else "unknown"
    return hashlib.sha256(ip.encode()).hexdigest()

def check_limit(user_id):
    today = str(date.today())
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT count FROM usage WHERE user_id=? AND day=?", (user_id, today))
    row = cur.fetchone()

    if row is None:
        cur.execute("INSERT INTO usage VALUES (?, ?, ?)", (user_id, today, 0))
        conn.commit()
        count = 0
    else:
        count = row[0]

    conn.close()
    return count

def add_usage(user_id):
    today = str(date.today())
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "UPDATE usage SET count = count + 1 WHERE user_id=? AND day=?",
        (user_id, today)
    )
    conn.commit()
    conn.close()

def transform_face(password, image, request: gr.Request):
    init_db()

    if password != ACCESS_PASSWORD:
        return None, "비밀번호가 맞지 않습니다. 유튜브 영상에서 안내된 비밀번호를 입력해 주세요."

    if image is None:
        return None, "사진을 먼저 업로드해 주세요."

    user_id = get_user_id(request)
    count = check_limit(user_id)

    if count >= DAILY_LIMIT:
        return None, f"오늘 무료 사용량 {DAILY_LIMIT}장을 모두 사용했습니다. 내일 다시 이용해 주세요."

    image.save("input.png")

    result = client.images.edit(
        model="gpt-image-1",
        image=open("input.png", "rb"),
        prompt=PROMPT,
        size="1024x1024"
    )

    image_base64 = result.data[0].b64_json
    image_bytes = base64.b64decode(image_base64)

    with open("result.png", "wb") as f:
        f.write(image_bytes)

    add_usage(user_id)

    remaining = DAILY_LIMIT - count - 1
    return "result.png", f"변환 완료! 오늘 남은 무료 사용량: {remaining}장"

demo = gr.Interface(
    fn=transform_face,
    inputs=[
        gr.Textbox(label="구독자 전용 비밀번호", type="password", placeholder="비밀번호 입력"),
        gr.Image(type="pil", label="사진 업로드")
    ],
    outputs=[
        gr.Image(type="filepath", label="변환 결과"),
        gr.Textbox(label="사용 안내")
    ],
    title="얼굴 프라이버시 변환기",
    description="유튜브 구독자 전용 무료 체험 앱입니다. 비밀번호 입력 후 하루 3장까지 사용할 수 있습니다."
)

demo.launch()
