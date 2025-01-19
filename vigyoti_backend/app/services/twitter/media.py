from typing import Optional
import httpx
from fastapi import UploadFile
from ...core.exceptions import ContentProcessingError
import logging

logger = logging.getLogger(__name__)

TWITTER_UPLOAD_API = "https://upload.twitter.com/1.1/media/upload.json"

async def upload_media_to_twitter(file: UploadFile, auth_token: str) -> str:
    """Upload media to Twitter"""
    try:
        # Read file content
        content = await file.read()
        
        headers = {
            "Authorization": f"Bearer {auth_token}",
        }
        
        # INIT command
        init_data = {
            "command": "INIT",
            "total_bytes": len(content),
            "media_type": file.content_type,
        }
        
        async with httpx.AsyncClient() as client:
            init_response = await client.post(
                TWITTER_UPLOAD_API,
                headers=headers,
                data=init_data
            )
            
            if init_response.status_code != 202:
                raise ContentProcessingError(f"Media upload initialization failed: {init_response.text}")
                
            media_id = init_response.json()["media_id_string"]
            
            # APPEND command
            append_data = {
                "command": "APPEND",
                "media_id": media_id,
                "segment_index": 0
            }
            files = {
                "media": content
            }
            
            append_response = await client.post(
                TWITTER_UPLOAD_API,
                headers=headers,
                data=append_data,
                files=files
            )
            
            if append_response.status_code != 204:
                raise ContentProcessingError(f"Media upload append failed: {append_response.text}")
            
            # FINALIZE command
            finalize_data = {
                "command": "FINALIZE",
                "media_id": media_id
            }
            
            finalize_response = await client.post(
                TWITTER_UPLOAD_API,
                headers=headers,
                data=finalize_data
            )
            
            if finalize_response.status_code != 201:
                raise ContentProcessingError(f"Media upload finalization failed: {finalize_response.text}")
            
            return media_id
            
    except Exception as e:
        logger.error(f"Error uploading media: {str(e)}")
        raise ContentProcessingError(f"Failed to upload media: {str(e)}") 