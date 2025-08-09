from dotenv import load_dotenv
import os
import sys
from datetime import timedelta

load_dotenv()

def get_appdata_dir(app_name="BFG_SchedulerApp"):
    # Check if running as a PyInstaller bundle
    if getattr(sys, 'frozen', False):
        # Running as compiled app
        if sys.platform == 'darwin':  # macOS
            # For .app bundles, use the app's directory
            app_dir = os.path.dirname(sys.executable)
            # Go up to the .app/Contents/MacOS level, then create data dir
            bundle_dir = os.path.dirname(os.path.dirname(app_dir))
            appdata_path = os.path.join(os.path.dirname(bundle_dir), f"{app_name}_Data")
        else:
            # Fallback for other platforms
            appdata_path = os.path.join(os.path.dirname(sys.executable), f"{app_name}_Data")
    else:
        # Running in development
        if os.name == 'nt':  # Windows
            base_dir = os.getenv('APPDATA', os.path.expanduser('~\\AppData\\Roaming'))
        else:  # Linux and macOS
            base_dir = os.getenv('XDG_DATA_HOME', os.path.expanduser('~/.local/share'))
        appdata_path = os.path.join(base_dir, app_name)
    
    os.makedirs(appdata_path, exist_ok=True)
    return appdata_path

def get_resource_path(relative_path):
    """Get absolute path to resource, works for dev and for PyInstaller"""
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    
    return os.path.join(base_path, relative_path)

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