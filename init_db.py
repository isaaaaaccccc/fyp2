from application import create_app, db
from application.models import DayOfWeek, User, Branch, Level, Coach, CoachBranch, CoachOffday, CoachPreference,\
                                Timetable, TimetableEntry
import pandas as pd
from werkzeug.security import generate_password_hash

branches_data = [
    ("Bukit Batok", "BB", 4),
    ("Choa Chu Kang", "CCK", 4),
    ("Changi", "CH", 5),
    ("Hougang", "HG", 4),
    ("Katong", "KT", 4),
    ("Pasir Ris", "PR", 6)
]

levels_data = [
    ("BearyTots", "Tots", 7, 2),  # 2 slots = 1 hour
    ("Jolly", "Jolly", 8, 2),
    ("Bubbly", "Bubbly", 8, 2),
    ("Lively", "Lively", 8, 2),
    ("Flexi", "Flexi", 8, 2),
    ("Level_1", "L1", 8, 3),
    ("Level_2", "L2", 9, 3),
    ("Level_3", "L3", 10, 3),
    ("Level_4", "L4", 10, 3),
    ("Advance", "Advance", 10, 2),
    ("Free", "Free", 10, 2)
]

coaches_df = pd.read_csv('../Updated Datasets/coaches_df.csv')
availability_df = pd.read_csv('../Updated Datasets/availability_df.csv')
availability_df = availability_df[availability_df['available'] == False]

def main():
    app = create_app()
    with app.app_context():
        db.drop_all()
        db.create_all()

        print("Creating branches...")
        for name, abbrv, max_classes in branches_data:
            branch = Branch(
                name=name,
                abbrv=abbrv,
                max_classes=max_classes
            )
            db.session.add(branch)

        print("Creating levels...")
        for name, alias, max_students, duration in levels_data:
            level = Level(
                name=name,
                alias=alias,
                max_students=max_students,
                duration=duration  # Number of 30-minute slots
            )
            db.session.add(level)
        
        # Create a default admin user
        print("Creating default admin user...")
        admin_user = User(
            username='admin',
            password=generate_password_hash('admin'),  # Properly hashed password
            permissions=1  # Full permissions
        )
        db.session.add(admin_user)
    
        print("Creating coaches...")
        for _, row in coaches_df.iterrows():
            coach = Coach(
                id=row['coach_id'],
                name=row['coach_name'],
                residential_area=row['residential_area'],
                position=row['position'] if not pd.isna(row['position']) else 'Part time',  # All part timers do not have a position
                status=row['status']
            )

            for branch_abbrv in row['assigned_branch'].split(','):
                branch = Branch.query.filter_by(abbrv=branch_abbrv.strip()).first()
                coach_branch = CoachBranch(
                    coach_id=coach.id,
                    branch_id=branch.id
                )
                db.session.add(coach_branch)
            
            for level_name, prefers_teaching in row.iloc[6:].items():
                if not prefers_teaching:
                    continue

                level = Level.query.filter_by(name=level_name).first()
                coach_preference = CoachPreference(
                    coach_id=coach.id,
                    level_id=level.id
                )
                db.session.add(coach_preference)            

            db.session.add(coach)

        for _, row in availability_df.iterrows():
            coach_offday = CoachOffday(
                coach_id=row['coach_id'],
                day=DayOfWeek[row['day']], 
                am=(row['period'] == 'am'),
                reason=row['restriction_reason']
            )
            db.session.add(coach_offday)

        db.session.commit()
            

if __name__ == '__main__':
    main()