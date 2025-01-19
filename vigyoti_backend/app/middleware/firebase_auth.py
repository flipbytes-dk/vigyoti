from fastapi import Request, HTTPException
from firebase_admin import auth
from functools import wraps

async def verify_firebase_token(request: Request):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='No token provided')
    
    token = auth_header.split('Bearer ')[1]
    try:
        decoded_token = auth.verify_id_token(token)
        request.state.user_id = decoded_token['uid']
        return decoded_token
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

def firebase_auth(func):
    @wraps(func)
    async def wrapper(request: Request, *args, **kwargs):
        await verify_firebase_token(request)
        return await func(request, *args, **kwargs)
    return wrapper 