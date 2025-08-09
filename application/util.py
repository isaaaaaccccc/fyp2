from flask import jsonify
from application import db
from application.models import DayOfWeek, User, Coach, Level, Branch, CoachBranch, CoachOffday, CoachPreference, Enrollment, PopularTimeslot
import pandas as pd

def format_schedule_for_display(schedule):
    """Format schedule data for timetable.js display"""
    formatted_classes = []
    
    # Day mapping for proper ordering
    day_order = {'TUE': 1, 'WED': 2, 'THU': 3, 'FRI': 4, 'SAT': 5, 'SUN': 6}
    
    # Branch color mapping
    branch_colors = {
        'BB': '#FF6B6B',    # Red
        'CCK': '#4ECDC4',   # Teal
        'CH': '#45B7D1',    # Blue
        'HG': '#96CEB4',    # Green
        'KT': '#FFEAA7',    # Yellow
        'PR': '#DDA0DD'     # Purple
    }
    
    for entry in schedule:
        # Convert to format expected by timetable.js
        formatted_entry = {
            'id': f"class_{entry.get('id', len(formatted_classes))}",
            'branch': entry['Branch'],
            'level': entry['Gymnastics Level'],
            'day': entry['Day'],
            'dayOrder': day_order.get(entry['Day'], 7),
            'startTime': entry['Start Time'],
            'endTime': entry['End Time'],
            'duration': entry.get('Duration (min)', 60),
            'coach': {
                'id': entry['Coach ID'],
                'name': entry['Coach Name'],
                'status': entry['Coach Status']
            },
            'students': entry['Students'],
            'capacity': entry['Capacity'],
            'isPopular': entry.get('Popular Slot', 'No') == 'Yes',
            'isMerged': entry.get('Merged', 'No') == 'Yes',
            'mergedWith': entry.get('Merged With', ''),
            'color': branch_colors.get(entry['Branch'], '#95A5A6'),
            'utilization': round((entry['Students'] / entry['Capacity']) * 100, 1) if entry['Capacity'] > 0 else 0
        }
        
        formatted_classes.append(formatted_entry)
    
    # Sort by day and time
    formatted_classes.sort(key=lambda x: (x['dayOrder'], x['startTime']))
    
    return formatted_classes

def process_level_config_file(file):
    """Process popular timeslots CSV file"""
    try:
        df = pd.read_csv(file)
        print(f"Loaded {len(df)} rows from level config CSV")
        
        if df.empty:
            raise ValueError("CSV file is empty")
        
        # Validate required columns
        required_columns = ['name', 'alias', 'max_students', 'duration']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")
        
        with db.session.no_autoflush:
            # Clear existing popular timeslots data
            deleted_count = db.session.query(Level).delete()
            print(f"Deleted {deleted_count} existing popular timeslot records")
            
            processed_count = 0
            for _, row in df.iterrows():
                try:
                    level = Level(
                        name=str(row['name']).strip(),
                        alias=str(row['alias']).strip(),
                        max_students=str(row['max_students']).strip(),
                        duration=int(row['duration']),
                    )
                    db.session.add(level)
                    processed_count += 1
                except Exception as e:
                    print(f"Error processing row {processed_count + 1}: {e}")
                    continue
        
        return f"Processed {processed_count} popular timeslot records"
    except Exception as e:
        print(f"Error in process_level_config_file: {e}")
        raise

# # File processing functions (same as before but with better error handling)
def process_availability_file(file):
    """Process availability CSV file"""
    try:
        df = pd.read_csv(file)
        df = df[df['available'] == False]
        print(f"Loaded {len(df)} rows from availability CSV")
        
        if df.empty:
            raise ValueError("CSV file is empty")
        
        # Validate required columns
        required_columns = ['availability_id', 'coach_id', 'day', 'period', 'available']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")
        
        with db.session.no_autoflush:
            deleted_count = db.session.query(CoachOffday).delete()
            print(f"Deleted {deleted_count} existing availability records")
            
            processed_count = 0
            for _, row in df.iterrows():
                try:
                    # Create new record
                    coach_offday = CoachOffday(
                        coach_id=row['coach_id'],
                        day=DayOfWeek[row['day']].value, 
                        am=(row['period'] == 'am'),
                        reason=row['restriction_reason']
                    )
                    db.session.add(coach_offday)
                    processed_count += 1
                except Exception as e:
                    print(f"Error processing row {processed_count + 1}: {e}")
                    continue
        
        return f"Processed {processed_count} availability records"
    except Exception as e:
        print(f"Error in process_availability_file: {e}")
        raise

def process_branch_config_file(file):
    """Process branch config CSV file"""
    try:
        df = pd.read_csv(file)
        print(f"Loaded {len(df)} rows from branch config CSV")
        
        if df.empty:
            raise ValueError("CSV file is empty")
        
        # Validate required columns
        required_columns = ['name', 'abbrv', 'max_classes_per_slot']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")
        
        with db.session.no_autoflush:
            # Clear existing branch config data
            deleted_count = db.session.query(Branch).delete()
            print(f"Deleted {deleted_count} existing Branch records")
            
            processed_count = 0
            for _, row in df.iterrows():
                try:
                    branch = Branch(
                        name=str(row['name']).strip(),
                        abbrv=str(row['abbrv']).strip(),
                        max_classes=int(row['max_classes_per_slot'])
                    )
                    db.session.add(branch)
                    processed_count += 1
                except Exception as e:
                    print(f"Error processing row {processed_count + 1}: {e}")
                    continue
        
        return f"Processed {processed_count} branch configurations"
    except Exception as e:
        print(f"Error in process_branch_config_file: {e}")
        raise

def process_coaches_file(file):
    """Process coaches CSV file with direct level qualification columns"""
    try:
        df = pd.read_csv(file)
        print(f"Loaded {len(df)} rows from coaches CSV")
        
        if df.empty:
            raise ValueError("CSV file is empty")
        
        # Validate required columns
        required_columns = ['coach_id', 'coach_name', 'residential_area', 'status']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")
        
        # Level qualification columns - these are now directly stored in the Coach model
        qualification_columns = [
            'BearyTots', 'Jolly', 'Bubbly', 'Lively', 'Flexi',
            'Level_1', 'Level_2', 'Level_3', 'Level_4', 'Advance', 'Free'
        ]
        
        processed_count = 0
        with db.session.no_autoflush:
            for _, row in df.iterrows():
                try:
                    coach_id = int(row['coach_id'])
                    existing_coach = Coach.query.filter_by(id=coach_id).first()
                    
                    # Handle position field
                    position = str(row['position']) if 'position' in row and not pd.isna(row['position']) else 'Part time'
                    
                    # Process qualification columns - default to False if not found
                    qualifications = {}
                    for col in qualification_columns:
                        value = False  # Default to False
                        if col in row:
                            if isinstance(row[col], bool):
                                value = row[col]
                            elif isinstance(row[col], str):
                                value = row[col].lower() in ('true', 'yes', '1', 't', 'y')
                            elif isinstance(row[col], (int, float)):
                                value = bool(row[col])
                        qualifications[col] = value
                    
                    if existing_coach:
                        # Update existing coach
                        existing_coach.name = str(row['coach_name']).strip()
                        existing_coach.residential_area = str(row['residential_area']).strip()
                        existing_coach.position = position.strip()
                        existing_coach.status = str(row['status']).strip()    
                    else:
                        # Create new coach with all fields
                        coach = Coach(
                            id=coach_id,
                            name=str(row['coach_name']).strip(),
                            residential_area=str(row['residential_area']).strip(),
                            position=str(row['position']).strip() if not pd.isna(row['position']) else 'Part time',
                            status=str(row['status']).strip()
                        )
                        db.session.add(coach)
                        db.session.flush()

                    # Process branch assignment if included
                    if 'assigned_branch' in row and pd.notna(row['assigned_branch']):
                        # First remove any existing branch assignments
                        if existing_coach:
                            CoachBranch.query.filter_by(coach_id=coach_id).delete()
                        
                        # Add new branch assignments
                        branch_str = str(row['assigned_branch'])
                        for branch_code in branch_str.replace(',', ' ').split():
                            branch_code = branch_code.strip().upper()
                            branch = Branch.query.filter_by(abbrv=branch_code).first()
                            if branch:
                                coach_branch = CoachBranch(coach_id=coach_id, branch_id=branch.id)
                                db.session.add(coach_branch)
                            else:
                                print(f"Branch with code {branch_code} not found")
                    
                    if existing_coach:
                        CoachPreference.query.filter_by(coach_id=coach_id).delete()
                    
                    for col, value in qualifications.items():
                        if not value:
                            continue
                        level = Level.query.filter_by(name=col).first()
                        if level:
                            preference = CoachPreference(coach_id=coach_id, level_id=level.id)
                            db.session.add(preference)
                    
                    processed_count += 1
                except Exception as e:
                    print(f"Error processing coach row {processed_count + 1}: {e}")
                    import traceback
                    traceback.print_exc()
                    continue
        
        return f"Processed {processed_count} coach records with level qualifications"
    except Exception as e:
        print(f"Error in process_coaches_file: {e}")
        import traceback
        traceback.print_exc()
        raise

def process_enrollment_file(file):
    """Process enrollment CSV file"""
    try:
        df = pd.read_csv(file)
        print(f"Loaded {len(df)} rows from enrollment CSV")
        
        if df.empty:
            raise ValueError("CSV file is empty")
        
        # Validate required columns
        required_columns = ['Branch', 'Level Category Base', 'Count']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")
        
        with db.session.no_autoflush:
            # Clear existing enrollment data
            deleted_count = db.session.query(Enrollment).delete()
            print(f"Deleted {deleted_count} existing enrollment records")
            
            processed_count = 0
            for _, row in df.iterrows():
                try:
                    enrollment = Enrollment(
                        branch=str(row['Branch']).strip(),
                        level_category_base=str(row['Level Category Base']).strip(),
                        count=int(row['Count'])
                    )
                    db.session.add(enrollment)
                    processed_count += 1
                except Exception as e:
                    print(f"Error processing row {processed_count + 1}: {e}")
                    continue
        
        return f"Processed {processed_count} enrollment records"
    except Exception as e:
        print(f"Error in process_enrollment_file: {e}")
        raise

def process_popular_timeslots_file(file):
    """Process popular timeslots CSV file"""
    try:
        df = pd.read_csv(file)
        print(f"Loaded {len(df)} rows from popular timeslots CSV")
        
        if df.empty:
            raise ValueError("CSV file is empty")
        
        # Validate required columns
        required_columns = ['time_slot', 'day', 'level']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")
        
        with db.session.no_autoflush:
            # Clear existing popular timeslots data
            deleted_count = db.session.query(PopularTimeslot).delete()
            print(f"Deleted {deleted_count} existing popular timeslot records")
            
            processed_count = 0
            for _, row in df.iterrows():
                try:
                    timeslot = PopularTimeslot(
                        time_slot=str(row['time_slot']).strip(),
                        day=str(row['day']).strip(),
                        level=str(row['level']).strip()
                    )
                    db.session.add(timeslot)
                    processed_count += 1
                except Exception as e:
                    print(f"Error processing row {processed_count + 1}: {e}")
                    continue
        
        return f"Processed {processed_count} popular timeslot records"
    except Exception as e:
        print(f"Error in process_popular_timeslots_file: {e}")
        raise

def transform_schedule_for_timetable_js(schedule):
    """
    Transform the scheduler output into the format expected by timetable.js
    
    Expected format:
    {
        "Branch1": {
            "coaches": ["Coach1", "Coach2"],
            "schedule": {
                "Day1": {
                    "Coach1": [
                        {"name": "Level1", "start_time": "0900", "duration": 2}
                    ]
                }
            }
        }
    }
    """
    # Day mapping to ensure consistent day names
    day_mapping = {
        'TUE': 'Tuesday',
        'WED': 'Wednesday', 
        'THU': 'Thursday',
        'FRI': 'Friday',
        'SAT': 'Saturday',
        'SUN': 'Sunday'
    }
    
    processed_data = {}
    
    # Count of processed entries for logging
    processed_count = 0
    skipped_count = 0
    
    # Group by branch
    for entry in schedule:
        branch = entry.get('Branch')
        day_code = entry.get('Day')
        coach_name = entry.get('Coach Name')
        
        # Map day code to full day name
        day = day_mapping.get(day_code, day_code)
        
        if not branch or not day or not coach_name:
            print(f"Skipping entry with missing data: {entry}")
            skipped_count += 1
            continue
            
        # Initialize branch if needed
        if branch not in processed_data:
            processed_data[branch] = {
                'coaches': [],
                'schedule': {}
            }
        
        # Initialize day if needed
        if day not in processed_data[branch]['schedule']:
            processed_data[branch]['schedule'][day] = {}
        
        # Add coach to the list of coaches if not already there
        if coach_name not in processed_data[branch]['coaches']:
            processed_data[branch]['coaches'].append(coach_name)
        
        # Initialize coach's schedule for this day if needed
        if coach_name not in processed_data[branch]['schedule'][day]:
            processed_data[branch]['schedule'][day][coach_name] = []
        
        try:
            # Format start time (remove colon)
            start_time = entry.get('Start Time', '').replace(':', '')
            if not start_time:
                raise ValueError(f"Missing start time in entry: {entry}")
                
            # Calculate duration in 30-minute blocks
            duration_mins = int(entry.get('Duration (min)', 60))
            duration_blocks = duration_mins // 30
            
            # Get level name
            level = entry.get('Gymnastics Level', '')
            if not level:
                raise ValueError(f"Missing level in entry: {entry}")
            
            # Create class info object
            class_info = {
                'name': level,
                'start_time': start_time,
                'duration': duration_blocks
            }
            
            # Add to coach's schedule
            processed_data[branch]['schedule'][day][coach_name].append(class_info)
            processed_count += 1
            
        except Exception as format_error:
            print(f"Error formatting entry {entry}: {str(format_error)}")
            skipped_count += 1
            continue
    
    # Sort coach names for consistent display
    for branch in processed_data:
        processed_data[branch]['coaches'].sort()
    
    print(f"Transformed {processed_count} schedule entries for timetable.js display")
    if skipped_count > 0:
        print(f"Skipped {skipped_count} entries due to missing or invalid data")
    
    # Print summary of the processed data
    branch_count = len(processed_data)
    class_count = 0
    day_counts = {}
    
    for branch in processed_data:
        for day in processed_data[branch]['schedule']:
            if day not in day_counts:
                day_counts[day] = 0
            
            for coach in processed_data[branch]['schedule'][day]:
                class_count += len(processed_data[branch]['schedule'][day][coach])
                day_counts[day] += len(processed_data[branch]['schedule'][day][coach])
    
    print(f"Generated timetable with {branch_count} branches and {class_count} total classes")
    for day, count in sorted(day_counts.items()):
        print(f"  - {day}: {count} classes")
    
    return processed_data

def generate_sample_timetable():
    """Generate a sample timetable when real data is insufficient"""
    print("Generating sample timetable data for demonstration")
    
    # Create a sample timetable structure
    sample_data = {
        "Bukit Batok": {
            "coaches": ["John Doe", "Jane Smith", "Alex Johnson"],
            "schedule": {
                "Tuesday": {
                    "John Doe": [
                        {"name": "L1", "start_time": "0900", "duration": 2},
                        {"name": "L2", "start_time": "1100", "duration": 2}
                    ],
                    "Jane Smith": [
                        {"name": "BearyTots", "start_time": "1400", "duration": 2},
                        {"name": "Jolly", "start_time": "1600", "duration": 2}
                    ]
                },
                "Wednesday": {
                    "Alex Johnson": [
                        {"name": "L3", "start_time": "1000", "duration": 2},
                        {"name": "Advance", "start_time": "1500", "duration": 2}
                    ],
                    "John Doe": [
                        {"name": "L1", "start_time": "1700", "duration": 2}
                    ]
                },
                "Thursday": {
                    "Jane Smith": [
                        {"name": "BearyTots", "start_time": "1000", "duration": 2},
                        {"name": "Bubbly", "start_time": "1400", "duration": 2}
                    ]
                },
                "Saturday": {
                    "John Doe": [
                        {"name": "L2", "start_time": "0900", "duration": 2},
                        {"name": "L3", "start_time": "1300", "duration": 2}
                    ],
                    "Alex Johnson": [
                        {"name": "Advance", "start_time": "1100", "duration": 2}
                    ]
                }
            }
        },
        "Choa Chu Kang": {
            "coaches": ["Mary Johnson", "Robert Chen"],
            "schedule": {
                "Tuesday": {
                    "Mary Johnson": [
                        {"name": "Jolly", "start_time": "1600", "duration": 2}
                    ]
                },
                "Friday": {
                    "Robert Chen": [
                        {"name": "L1", "start_time": "1000", "duration": 2},
                        {"name": "L2", "start_time": "1400", "duration": 2}
                    ],
                    "Mary Johnson": [
                        {"name": "BearyTots", "start_time": "1600", "duration": 2}
                    ]
                },
                "Sunday": {
                    "Robert Chen": [
                        {"name": "L3", "start_time": "0900", "duration": 2}
                    ],
                    "Mary Johnson": [
                        {"name": "Jolly", "start_time": "1100", "duration": 2},
                        {"name": "Bubbly", "start_time": "1400", "duration": 2}
                    ]
                }
            }
        }
    }
    
    print("Generated sample timetable with 2 branches and multiple classes")
    return jsonify(sample_data)