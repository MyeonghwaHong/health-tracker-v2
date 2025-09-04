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
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3

# 환경변수 로드
load_dotenv()

# Flask 앱 생성
app = Flask(__name__)

# 시크릿 키 설정
app.secret_key = os.environ.get('SECRET_KEY', 'your-default-secret-key-change-this')

# CORS 설정
CORS(app, 
     origins=['http://localhost:3000'], 
     supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])

# 데이터베이스 초기화
def init_db():
    conn = sqlite3.connect('health_tracker.db')
    cursor = conn.cursor()
    
    # 사용자 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 건강 데이터 테이블
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS health_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            category TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            UNIQUE(user_id, date, category)
        )
    ''')
    
    conn.commit()
    conn.close()

# 데이터베이스 초기화 실행
init_db()

# 데이터베이스 연결 헬퍼
def get_db():
    return sqlite3.connect('health_tracker.db')

# CORS preflight 요청 처리
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = jsonify({})
        response.headers.add("Access-Control-Allow-Origin", "http://localhost:3000")
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization")
        response.headers.add('Access-Control-Allow-Methods', "GET,PUT,POST,DELETE,OPTIONS")
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

# 기본 라우트
@app.route('/')
def hello():
    return jsonify({"message": "Health Tracker API is running!"})

@app.route('/health')
def health_check():
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

# 인증 확인
@app.route('/api/check-auth')
def check_auth():
    if 'user_id' in session:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT id, name, email FROM users WHERE id = ?', (session['user_id'],))
        user = cursor.fetchone()
        conn.close()
        
        if user:
            return jsonify({
                'authenticated': True,
                'user': {
                    'id': user[0],
                    'name': user[1],
                    'email': user[2]
                }
            })
    
    return jsonify({'authenticated': False})

# 회원가입
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    
    if not name or not email or not password:
        return jsonify({'error': '모든 필드를 입력해주세요.'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    
    # 이메일 중복 확인
    cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'error': '이미 사용중인 이메일입니다.'}), 400
    
    # 사용자 생성
    password_hash = generate_password_hash(password)
    cursor.execute('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
                   (name, email, password_hash))
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    # 세션에 사용자 정보 저장
    session['user_id'] = user_id
    
    return jsonify({
        'user': {
            'id': user_id,
            'name': name,
            'email': email
        }
    })

# 로그인
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': '이메일과 비밀번호를 입력해주세요.'}), 400
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, email, password_hash FROM users WHERE email = ?', (email,))
    user = cursor.fetchone()
    conn.close()
    
    if not user or not check_password_hash(user[3], password):
        return jsonify({'error': '이메일 또는 비밀번호가 잘못되었습니다.'}), 400
    
    # 세션에 사용자 정보 저장
    session['user_id'] = user[0]
    
    return jsonify({
        'user': {
            'id': user[0],
            'name': user[1],
            'email': user[2]
        }
    })

# 로그아웃
@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': '로그아웃되었습니다.'})

# 건강 데이터 조회
@app.route('/api/health-data/<date>')
def get_health_data(date):
    if 'user_id' not in session:
        return jsonify({'error': '로그인이 필요합니다.'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT category, data FROM health_data WHERE user_id = ? AND date = ?',
                   (session['user_id'], date))
    results = cursor.fetchall()
    conn.close()
    
    health_data = {}
    for category, data in results:
        try:
            health_data[category] = json.loads(data)
        except:
            health_data[category] = data
    
    # 기본값 설정
    if not health_data:
        health_data = {
            'water': {
                'count': 8,
                'targetAmount': 2000,
                'records': [{'amount': '', 'completed': False, 'time': ''} for _ in range(8)]
            },
            'meals': {
                'count': 4,
                'labels': ['아침', '점심', '간식', '저녁'],
                'records': [{'food': '', 'completed': False, 'time': '', 'photo': None} for _ in range(4)]
            },
            'exercise': {'type': '', 'duration': '', 'completed': False},
            'weight': ''
        }
    
    return jsonify(health_data)

# 건강 데이터 저장
@app.route('/api/health-data/<date>/<category>', methods=['POST'])
def save_health_data(date, category):
    if 'user_id' not in session:
        return jsonify({'error': '로그인이 필요합니다.'}), 401
    
    data = request.json
    
    conn = get_db()
    cursor = conn.cursor()
    
    # 데이터가 이미 있는지 확인
    cursor.execute('SELECT id FROM health_data WHERE user_id = ? AND date = ? AND category = ?',
                   (session['user_id'], date, category))
    existing = cursor.fetchone()
    
    data_str = json.dumps(data) if isinstance(data, (dict, list)) else str(data)
    
    if existing:
        cursor.execute('UPDATE health_data SET data = ? WHERE user_id = ? AND date = ? AND category = ?',
                       (data_str, session['user_id'], date, category))
    else:
        cursor.execute('INSERT INTO health_data (user_id, date, category, data) VALUES (?, ?, ?, ?)',
                       (session['user_id'], date, category, data_str))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': '저장되었습니다.'})

# 체중 차트 데이터
@app.route('/api/health-data/weight-chart')
def get_weight_chart():
    if 'user_id' not in session:
        return jsonify({'error': '로그인이 필요합니다.'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT date, data FROM health_data 
        WHERE user_id = ? AND category = "weight" AND data != "" 
        ORDER BY date DESC LIMIT 30
    ''', (session['user_id'],))
    results = cursor.fetchall()
    conn.close()
    
    chart_data = []
    for date_str, weight_str in results:
        try:
            weight = float(weight_str)
            chart_data.append({
                'date': date_str,
                'weight': weight
            })
        except:
            continue
    
    # 날짜순으로 정렬
    chart_data.sort(key=lambda x: x['date'])
    
    return jsonify(chart_data)

# 데이터 내보내기
@app.route('/api/health-data/export')
def export_data():
    if 'user_id' not in session:
        return jsonify({'error': '로그인이 필요합니다.'}), 401
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT date, category, data FROM health_data WHERE user_id = ?',
                   (session['user_id'],))
    results = cursor.fetchall()
    conn.close()
    
    export_data = {}
    for date_str, category, data in results:
        if date_str not in export_data:
            export_data[date_str] = {}
        try:
            export_data[date_str][category] = json.loads(data)
        except:
            export_data[date_str][category] = data
    
    return jsonify(export_data)

# 데이터 가져오기
@app.route('/api/health-data/import', methods=['POST'])
def import_data():
    if 'user_id' not in session:
        return jsonify({'error': '로그인이 필요합니다.'}), 401
    
    import_data = request.json
    
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        for date_str, categories in import_data.items():
            for category, data in categories.items():
                data_str = json.dumps(data) if isinstance(data, (dict, list)) else str(data)
                
                # 기존 데이터 확인 및 업데이트/삽입
                cursor.execute('SELECT id FROM health_data WHERE user_id = ? AND date = ? AND category = ?',
                               (session['user_id'], date_str, category))
                existing = cursor.fetchone()
                
                if existing:
                    cursor.execute('UPDATE health_data SET data = ? WHERE user_id = ? AND date = ? AND category = ?',
                                   (data_str, session['user_id'], date_str, category))
                else:
                    cursor.execute('INSERT INTO health_data (user_id, date, category, data) VALUES (?, ?, ?, ?)',
                                   (session['user_id'], date_str, category, data_str))
        
        conn.commit()
        conn.close()
        return jsonify({'message': '데이터를 성공적으로 가져왔습니다.'})
    
    except Exception as e:
        conn.close()
        return jsonify({'error': '데이터 가져오기 중 오류가 발생했습니다.'}), 500

# 404 에러 핸들러
@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "error": "Not Found",
        "message": "The requested URL was not found on the server.",
        "available_routes": [
            "/",
            "/health",
            "/api/check-auth",
            "/api/register",
            "/api/login", 
            "/api/logout",
            "/api/health-data/<date>",
            "/api/health-data/<date>/<category>",
            "/api/health-data/weight-chart",
            "/api/health-data/export",
            "/api/health-data/import"
        ]
    }), 404

# 앱 실행
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(
        debug=True,
        host='127.0.0.1',
        port=port
    )
