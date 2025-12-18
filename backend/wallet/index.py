import json
import os
from typing import Dict, Any
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Управляет операциями с кошельком: получение балансов, обмен валют, вывод средств
    Args: event - запрос с методом и параметрами операции
          context - контекст выполнения функции
    Returns: данные кошелька, результат операции или историю транзакций
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Token',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    headers = event.get('headers', {})
    user_token = headers.get('x-user-token') or headers.get('X-User-Token')
    
    if not user_token:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Unauthorized'}),
            'isBase64Encoded': False
        }
    
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    
    try:
        if method == 'GET':
            query_params = event.get('queryStringParameters', {})
            user_id = query_params.get('user_id')
            action = query_params.get('action', 'balance')
            
            if action == 'balance':
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        "SELECT currency, balance FROM wallets WHERE user_id = %s ORDER BY currency",
                        (user_id,)
                    )
                    wallets = cur.fetchall()
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'wallets': wallets}, default=str),
                        'isBase64Encoded': False
                    }
            
            elif action == 'history':
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        "SELECT * FROM transactions WHERE user_id = %s ORDER BY created_at DESC LIMIT 50",
                        (user_id,)
                    )
                    transactions = cur.fetchall()
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'transactions': transactions}, default=str),
                        'isBase64Encoded': False
                    }
        
        elif method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            action = body_data.get('action')
            user_id = body_data.get('user_id')
            
            if action == 'exchange':
                from_currency = body_data.get('from_currency')
                to_currency = body_data.get('to_currency')
                from_amount = float(body_data.get('from_amount'))
                rate = float(body_data.get('rate'))
                to_amount = from_amount * rate
                
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        "SELECT balance FROM wallets WHERE user_id = %s AND currency = %s",
                        (user_id, from_currency)
                    )
                    wallet = cur.fetchone()
                    
                    if not wallet or float(wallet['balance']) < from_amount:
                        return {
                            'statusCode': 400,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'error': 'Insufficient balance'}),
                            'isBase64Encoded': False
                        }
                    
                    cur.execute(
                        "UPDATE wallets SET balance = balance - %s WHERE user_id = %s AND currency = %s",
                        (from_amount, user_id, from_currency)
                    )
                    
                    cur.execute(
                        "UPDATE wallets SET balance = balance + %s WHERE user_id = %s AND currency = %s",
                        (to_amount, user_id, to_currency)
                    )
                    
                    cur.execute(
                        "INSERT INTO transactions (user_id, type, from_currency, to_currency, from_amount, to_amount, rate, status) VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
                        (user_id, 'exchange', from_currency, to_currency, from_amount, to_amount, rate, 'completed')
                    )
                    
                    transaction = cur.fetchone()
                    conn.commit()
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({
                            'success': True,
                            'transaction_id': transaction['id'],
                            'to_amount': to_amount
                        }, default=str),
                        'isBase64Encoded': False
                    }
            
            elif action == 'withdraw':
                currency = body_data.get('currency')
                amount = float(body_data.get('amount'))
                telegram_wallet = body_data.get('telegram_wallet')
                
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        "SELECT balance FROM wallets WHERE user_id = %s AND currency = %s",
                        (user_id, currency)
                    )
                    wallet = cur.fetchone()
                    
                    if not wallet or float(wallet['balance']) < amount:
                        return {
                            'statusCode': 400,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'error': 'Insufficient balance'}),
                            'isBase64Encoded': False
                        }
                    
                    cur.execute(
                        "UPDATE wallets SET balance = balance - %s WHERE user_id = %s AND currency = %s",
                        (amount, user_id, currency)
                    )
                    
                    cur.execute(
                        "INSERT INTO transactions (user_id, type, from_currency, from_amount, status) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                        (user_id, 'withdraw', currency, amount, 'completed')
                    )
                    
                    transaction = cur.fetchone()
                    conn.commit()
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({
                            'success': True,
                            'transaction_id': transaction['id'],
                            'message': f'Withdrawal to {telegram_wallet} initiated'
                        }, default=str),
                        'isBase64Encoded': False
                    }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    finally:
        conn.close()
