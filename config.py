from dotenv import load_dotenv
import os
from datetime import timedelta

load_dotenv()

def get_appdata_dir(app_name="BFG_SchedulerApp"):
    if os.name == 'nt':  # Windows
        base_dir = os.getenv('APPDATA', os.path.expanduser('~\\AppData\\Roaming'))
    else:  # Linux and others
        base_dir = os.getenv('XDG_DATA_HOME', os.path.expanduser('~/.local/share'))
    
    appdata_path = os.path.join(base_dir, app_name)
    os.makedirs(appdata_path, exist_ok=True)
    
    return appdata_path

class Config:
    """Base configuration class"""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False
    
    # File upload settings
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
    UPLOAD_FOLDER = 'uploads'
    
    # Session settings
    PERMANENT_SESSION_LIFETIME = timedelta(hours=24)

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    SQLALCHEMY_ECHO = True  # Show SQL queries in development
    
    # SQLite for development
    basedir = os.path.abspath(os.path.dirname(__file__))
    SQLALCHEMY_DATABASE_URI = f'sqlite:///database.db'

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    
    appdata_path = get_appdata_dir()
    SQLALCHEMY_DATABASE_URI = f'sqlite:///{os.path.join(appdata_path, "database.db")}'

class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'  # In-memory database for testing

# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}