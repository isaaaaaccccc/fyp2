from application import create_app, db
from application.models import User, Branch, Level, Coach, CoachBranch, CoachOffday, CoachPreference
import pandas as pd



def main():
    app = create_app()
    with app.app_context():
        coaches = Coach.query.all()
        levels = [name for (name,) in db.session.query(Level.name).order_by(Level.id).all()]

        print(levels)
        
        coach_data = []
        availability_data = []
        for coach in coaches:
            details = {
                'coach_id': coach.id,
                'coach_name': coach.name,
                'residential_area': coach.residential_area,
                'assigned_branch': ', '.join([cb.branch.abbrv for cb in coach.assigned_branches]),
                'position': coach.position,
                'status': coach.status
            }
            preferred_levels = {cl.level.name for cl in coach.preferred_levels}
            preference = {level: int(level in preferred_levels) for level in levels}
            coach_data.append(details | preference)

            for cd in coach.offdays:
                availability = {
                    'coach_id': coach.id,
                    'day': cd.day,
                    'am': int(cd.am)
                }
                availability_data.append(availability)
            
        coach_df = pd.DataFrame(coach_data)
        availability_df = pd.DataFrame(availability_data)

        with pd.ExcelWriter('coaches_export.xlsx', engine='openpyxl') as writer:
            coach_df.to_excel(writer, sheet_name='General Details', index=False)
            availability_df.to_excel(writer, sheet_name='Availability', index=False)



        print(coaches)


        
            

if __name__ == '__main__':
    main()