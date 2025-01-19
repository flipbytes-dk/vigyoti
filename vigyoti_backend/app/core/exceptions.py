class ContentProcessingError(Exception):
    """Raised when there's an error processing content from any source"""
    pass

class ContentGenerationError(Exception):
    """Raised when there's an error generating content"""
    pass

class ContentSchedulingError(Exception):
    """Raised when there's an error scheduling content"""
    pass

class InvalidCredentialsError(Exception):
    """Raised when API credentials are invalid or missing"""
    pass

class RateLimitError(Exception):
    """Raised when hitting API rate limits"""
    pass

class FileSizeError(Exception):
    """Raised when file size exceeds limits"""
    pass

class FileTypeError(Exception):
    """Raised when file type is not supported"""
    pass

class DatabaseError(Exception):
    """Raised when there's a database-related error"""
    pass
