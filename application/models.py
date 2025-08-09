from application import db
from flask_login import UserMixin
from datetime import datetime
import enum

class DayOfWeek(enum.IntEnum):
    MON = 0
    TUE = 1
    WED = 2
    THU = 3
    FRI = 4
    SAT = 5
    SUN = 6

# =============================================================
# =========================== Users ===========================
# =============================================================

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(32), nullable=False, unique=True)
    password = db.Column(db.String(128), nullable=False)
    permissions = db.Column(db.Integer, nullable=False)  # Whether a person has read or edit access 
    time_joined = db.Column(db.DateTime, nullable=False, default=datetime.now)

# =============================================================
# ==================== Relational Entities ====================
# =============================================================

class Branch(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(32), nullable=False, unique=True)
    abbrv = db.Column(db.String(4), nullable=False, unique=True)  # Abbreviated form
    max_classes = db.Column(db.Integer, nullable=False)

    assigned_coaches = db.relationship('CoachBranch', back_populates='branch')

class Level(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(32), nullable=False, unique=True)
    alias = db.Column(db.String(32), nullable=False, unique=True)
    max_students = db.Column(db.Integer, nullable=False)
    duration = db.Column(db.Integer, nullable=False)  # Duration will be in terms of number of 30min timeslots

    preferred_by_coaches = db.relationship('CoachPreference', back_populates='level')

class Coach(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(32), nullable=False, unique=True)
    residential_area = db.Column(db.String(32), nullable=False)
    position = db.Column(db.String(32), nullable=False)
    status = db.Column(db.String(32), nullable=False)

    assigned_branches = db.relationship('CoachBranch', back_populates='coach', cascade='all, delete-orphan')
    offdays = db.relationship('CoachOffday', back_populates='coach', cascade='all, delete-orphan')
    preferred_levels = db.relationship('CoachPreference', back_populates='coach', cascade='all, delete-orphan')

# =============================================================
# ===================== New Upload Models =====================
# =============================================================


class Enrollment(db.Model):
    __tablename__ = 'enrollment'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    branch = db.Column(db.String(10), nullable=False)
    level_category_base = db.Column(db.String(50), nullable=False)
    count = db.Column(db.Integer, nullable=False)

class PopularTimeslot(db.Model):
    __tablename__ = 'popular_timeslot'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    time_slot = db.Column(db.String(20), nullable=False)
    day = db.Column(db.String(10), nullable=False)
    level = db.Column(db.String(20), nullable=False)

# =============================================================
# ===== Association tables for many-to-many relationships =====
# =============================================================

# Handles which branch a coach gets assigned to
class CoachBranch(db.Model):
    __tablename__ = 'coach_branch'

    coach_id = db.Column(db.Integer, db.ForeignKey('coach.id'), primary_key=True)
    branch_id = db.Column(db.Integer, db.ForeignKey('branch.id'), primary_key=True)

    coach = db.relationship('Coach', back_populates='assigned_branches')
    branch = db.relationship('Branch', back_populates='assigned_coaches')

# Handles which days/timeslots a coach can work on
class CoachOffday(db.Model):
    __tablename__ = 'coach_offday'

    coach_id = db.Column(db.Integer, db.ForeignKey('coach.id'), primary_key=True)
    day = db.Column(db.Integer, primary_key=True)  # 0 = Monday, 6 = Sunday
    am = db.Column(db.Boolean, primary_key=True)
    reason = db.Column(db.String(64), nullable=True)  

    coach = db.relationship('Coach', back_populates='offdays')

# Handles which class levels a coach prefers to teach, (eg. L1, L2) 
class CoachPreference(db.Model):
    __tablename__ = 'coach_preference'

    coach_id = db.Column(db.Integer, db.ForeignKey('coach.id'), primary_key=True)
    level_id = db.Column(db.Integer, db.ForeignKey('level.id'), primary_key=True)

    coach = db.relationship('Coach', back_populates='preferred_levels')
    level = db.relationship('Level', back_populates='preferred_by_coaches')

# =============================================================
# ==================== Generated Timetable ====================
# =============================================================

class Timetable(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    active = db.Column(db.Boolean, nullable=False, default=False)
    date_created = db.Column(db.DateTime, nullable=False, default=datetime.now)

    entries = db.relationship('TimetableEntry', back_populates='timetable', cascade='all, delete-orphan')
    

class TimetableEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)

    branch_id = db.Column(db.Integer, db.ForeignKey('branch.id'))
    coach_id = db.Column(db.Integer, db.ForeignKey('coach.id'))
    level_id = db.Column(db.Integer, db.ForeignKey('level.id'))
    start_time = db.Column(db.Time, nullable=False)
    day = db.Column(db.Integer, nullable=False)

    timetable_id = db.Column(db.Integer, db.ForeignKey('timetable.id'), nullable=False)

    coach = db.relationship('Coach')
    level = db.relationship('Level')
    branch = db.relationship('Branch')

    timetable = db.relationship('Timetable', back_populates='entries')

    __table_args__ = (
        db.UniqueConstraint(
            'timetable_id', 'coach_id', 'level_id', 'branch_id', 'start_time', 'day',
            name='unique_entry'
        ),
    )