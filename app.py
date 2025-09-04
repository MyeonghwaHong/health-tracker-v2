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

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY') # 실제 환경에서는 환경변수로 설정

# CORS 설정을 더 구체적으로 설정
CORS(app, 
     origins=['http://localhost:3000'], 
     supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])