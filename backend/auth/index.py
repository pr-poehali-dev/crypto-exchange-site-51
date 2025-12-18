import json
import os
import hashlib
import uuid
from typing import Dict, Any
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Обрабатывает регистрацию и авторизацию пользователей криптоплатформы
    Args: event - запрос с методом и данными пользователя
          context - контекст выполнения функции
    Returns: токен сессии и данные пользователя
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Token',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    body_data = json.loads(event.get('body', '{}'))
    action = body_data.get('action')
    
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    
    try:
        if action == 'register':
            email = body_data.get('email')
            password = body_data.get('password')
            full_name = body_data.get('full_name')
            telegram_wallet = body_data.get('telegram_wallet', '')
            
            password_hash = hashlib.sha256(password.encode()).hexdigest()
            
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "INSERT INTO users (email, password_hash, full_name, telegram_wallet) VALUES (%s, %s, %s, %s) RETURNING id, email, full_name, telegram_wallet, created_at",
                    (email, password_hash, full_name, telegram_wallet)
                )
                user = cur.fetchone()
                
                currencies = ['BTC', 'ETH', 'USDT', 'BNB', 'XRP']
                for currency in currencies:
                    cur.execute(
                        "INSERT INTO wallets (user_id, currency, balance) VALUES (%s, %s, %s)",
                        (user['id'], currency, 0)
                    )
                
                conn.commit()
                
                token = str(uuid.uuid4())
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'token': token,
                        'user': {
                            'id': user['id'],
                            'email': user['email'],
                            'full_name': user['full_name'],
                            'telegram_wallet': user['telegram_wallet']
                        }
                    }, default=str),
                    'isBase64Encoded': False
                }
        
        elif action == 'login':
            email = body_data.get('email')
            password = body_data.get('password')
            
            password_hash = hashlib.sha256(password.encode()).hexdigest()
            
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, email, full_name, telegram_wallet FROM users WHERE email = %s AND password_hash = %s",
                    (email, password_hash)
                )
                user = cur.fetchone()
                
                if not user:
                    return {
                        'statusCode': 401,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Invalid credentials'}),
                        'isBase64Encoded': False
                    }
                
                token = str(uuid.uuid4())
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'token': token,
                        'user': {
                            'id': user['id'],
                            'email': user['email'],
                            'full_name': user['full_name'],
                            'telegram_wallet': user['telegram_wallet']
                        }
                    }),
                    'isBase64Encoded': False
                }
        
        else:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Invalid action'}),
                'isBase64Encoded': False
            }
    
    finally:
        conn.close()
