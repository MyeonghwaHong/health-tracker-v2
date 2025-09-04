from flask import Flask, request, jsonify, session
from flask_cors import CORS
import pandas as pd
import pyarrow as pa
import pyarrow.feather as feather
import os
import hashlib
import uuid
from datetime import datetime, date
from dotenv import load_dotenv
import json

# 환경변수 로드
load_dotenv()

# Flask 앱 생성
app = Flask(__name__)

# 시크릿 키 설정 (환경변수에서 가져오거나 기본값 사용)
app.secret_key = os.environ.get('SECRET_KEY', 'your-default-secret-key-change-this')

# CORS 설정
CORS(app, 
     origins=['http://localhost:3000'], 
     supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])

# 기본 라우트 추가 (테스트용)
@app.route('/')
def hello():
    return jsonify({"message": "Flask app is running!"})

@app.route('/health')
def health_check():
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

# 앱 실행
if __name__ == '__main__':
    # 디버그 모드로 실행 (개발 환경에서만 사용)
    app.run(
        debug=True,
        host='127.0.0.1',
        port=5000
    )
