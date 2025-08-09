from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_login import current_user, LoginManager
from config import config, DevelopmentConfig
import sys
import os 

db = SQLAlchemy()
bcrypt = Bcrypt()
login_manager = LoginManager()

def create_app(config_name='default'):
    if getattr(sys, 'frozen', False):
        base_path = sys._MEIPASS
    else:
        base_path = os.path.abspath(os.path.dirname(__file__))
        
    app = Flask(
        __name__,
        static_folder=os.path.join(base_path, 'static'),
        template_folder=os.path.join(base_path, 'templates'),
    )
    app.config.from_object(config.get(config_name, DevelopmentConfig))

    db.init_app(app)
    bcrypt.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = '/'

    with app.app_context():
        from .models import User, Branch, Level, Coach, Enrollment, PopularTimeslot, CoachBranch, CoachOffday, CoachPreference, Timetable, TimetableEntry
        db.create_all()
        db.session.commit()

    # from application.forms import LoginForm, RegisterForm

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    @app.context_processor
    def get_user():
        return {'user': current_user}

    from application.routes.api import api_bp
    from application.routes.frontend import pages_bp
    from application.routes.timetable import timetable_bp

    app.register_blueprint(pages_bp)
    app.register_blueprint(api_bp)
    app.register_blueprint(timetable_bp)
    
    return app