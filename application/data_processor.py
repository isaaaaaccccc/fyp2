import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict, List, Tuple, Set, Optional
from application import db
from application.models import DayOfWeek, User, Coach, Level, Branch, CoachBranch, CoachOffday, CoachPreference, Enrollment, PopularTimeslot

class DataDrivenProcessor:
    """
    Completely data-driven processor - reads ALL business rules from database
    """
    
    def __init__(self):
        print(f"Current Date and Time (UTC - YYYY-MM-DD HH:MM:SS formatted): {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        current_user = User.query.first()
        print(f"Current User's Login: {current_user.username if current_user else 'unknown'}")
        print("DATA-DRIVEN PROCESSOR - DB DRIVEN")
        print("=" * 70)
        
    def load_and_process_data(self):
        """Main data loading - everything from database"""
        print("Loading ALL data from database...")
        
        # Load ALL database models
        self._load_all_from_db()
        
        # Extract business rules from actual data
        self._extract_business_rules_from_data()
        
        # Process all components
        self.coaches_data = self._process_coaches_from_data()
        self.requirements_data = self._process_requirements_from_data()
        self.popular_timeslots_set = self._process_popular_timeslots_from_data()
        self.timeslots_data = self._generate_timeslots_from_operating_hours()
        self.feasible_assignments = self._generate_feasible_assignments_from_data()
        
        print(f"✓ Processed {len(self.coaches_data)} coaches from data")
        print(f"✓ Processed {len(self.requirements_data)} requirements from data")
        print(f"✓ Loaded {len(self.popular_timeslots_set)} popular timeslot definitions from data")
        print(f"✓ Generated {len(self.timeslots_data)} valid timeslots from operating hours")
        print(f"✓ Created {len(self.feasible_assignments)} feasible assignments")
        
        return self._package_comprehensive_data()
    
    def _load_all_from_db(self):
        """Load all available data from database models"""
        
        # Enrollment data
        enrollments = Enrollment.query.all()
        self.enrollment_df = pd.DataFrame([{
            'Branch': enrollment.branch,
            'Level Category Base': enrollment.level_category_base,
            'Count': enrollment.count
        } for enrollment in enrollments])
        print(f"  ✓ Loaded enrollments from DB: {len(self.enrollment_df)} records")
        
        # Coaches data - now with qualification columns directly
        coaches = Coach.query.all()
        coach_records = []

        levels = db.session.query(Level.name).order_by(Level.id).all()
        
        for coach in coaches:
            # Get branch assignments as a string
            assigned_branches = [cb.branch.abbrv for cb in coach.assigned_branches]
            assigned_branch_str = ",".join(assigned_branches)

            preference = {level: False for (level,) in levels}

            level_preference = db.session.query(CoachPreference).filter(CoachPreference.coach_id == coach.id).all()
            for cl in level_preference:
                preference[cl.level.name] = True
            
            # Create record with all qualification columns directly from the model
            record = {
                'coach_id': coach.id,
                'coach_name': coach.name,
                'residential_area': coach.residential_area,
                'position': coach.position,
                'status': coach.status,
                'assigned_branch': assigned_branch_str
            }

            coach_records.append(record | preference)
        
        self.coaches_df = pd.DataFrame(coach_records)
        print(f"  ✓ Loaded coaches from DB: {len(self.coaches_df)} records")
        
        # Availability data
        offdays = CoachOffday.query.all()

        offday_dict = {}
        for offday in offdays:
            day = DayOfWeek(offday.day).name
            period = 'am' if offday.am else 'pm'
            offday_dict[(offday.coach_id, day, period)] = offday
        
        availability_data = []
        for coach in coaches:
            for day in DayOfWeek:
                for period in ['am', 'pm']:
                    key = (coach.id, day.name, period)
                    available = key not in offday_dict
                    availability_data.append({
                        'coach_id': coach.id,
                        'day': day.name,
                        'period': period,
                        'available': available,
                        'restriction_reason': None if available else offday_dict[key].reason
                    })
        
        self.availability_df = pd.DataFrame(availability_data)

        print(f"  ✓ Loaded availability from DB: {len(self.availability_df)} records")
        
        # Popular timeslots data
        popular_slots = PopularTimeslot.query.all()
        self.popular_df = pd.DataFrame([{
            'time_slot': slot.time_slot,
            'day': slot.day,
            'level': slot.level
        } for slot in popular_slots])
        print(f"  ✓ Loaded popular timeslots from DB: {len(self.popular_df)} records")
        
        # Branch config data
        branches = Branch.query.all()
        if branches:
            self.branch_config_df = pd.DataFrame([{
                'branch': branch.abbrv,
                'max_classes_per_slot': branch.max_classes
            } for branch in branches])
            print(f"  ✓ Loaded branch configs from DB: {len(self.branch_config_df)} records")
        else:
            # Create from description if no data
            self.branch_config_df = pd.DataFrame({
                'branch': ['BB', 'CCK', 'CH', 'HG', 'KT', 'PR'],
                'max_classes_per_slot': [4, 4, 5, 4, 4, 6]
            })
            print(f"  ℹ Created branch_config from business rules: {len(self.branch_config_df)} records")
    
    def _extract_business_rules_from_data(self):
        """Extract ALL business rules from the actual data"""
        print("  Extracting business rules from database data...")
        
        # Extract levels from enrollment data or Level model
        self.all_levels = sorted(self.enrollment_df['Level Category Base'].unique()) if not self.enrollment_df.empty else []
        if not self.all_levels:
            self.all_levels = sorted([level.name for level in Level.query.all()])
            
        # Map DB level names to expected format
        level_mapping = {
            'BearyTots': 'Tots',
            'L1': 'L1',
            'L2': 'L2',
            'L3': 'L3',
            'L4': 'L4'
        }
        
        self.all_levels = [level_mapping.get(level, level) for level in self.all_levels]
        print(f"    Levels found in data: {self.all_levels}")
        
        # Extract branches from enrollment data or Branch model
        self.all_branches = sorted(self.enrollment_df['Branch'].unique()) if not self.enrollment_df.empty else []
        if not self.all_branches:
            self.all_branches = sorted([branch.abbrv for branch in Branch.query.all()])
        print(f"    Branches found in data: {self.all_branches}")
        
        # Extract days from availability data or use standard days
        available_days = sorted(self.availability_df['day'].unique()) if not self.availability_df.empty else []
        if not available_days:
            available_days = ['TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
        
        # Filter to operating days (exclude MON based on business rule)
        self.all_days = [day for day in available_days if day != 'MON']
        print(f"    Operating days found in data: {self.all_days}")
        
        # Categorize days
        self.weekdays = [day for day in self.all_days if day in ['TUE', 'WED', 'THU', 'FRI']]
        self.weekends = [day for day in self.all_days if day in ['SAT', 'SUN']]
        print(f"    Weekdays: {self.weekdays}, Weekends: {self.weekends}")
        
        # Extract coach statuses from coaches data
        coach_statuses = set()
        if not self.coaches_df.empty:
            if 'status' in self.coaches_df.columns:
                coach_statuses.update(self.coaches_df['status'].dropna().unique())
            if 'position' in self.coaches_df.columns:
                coach_statuses.update(self.coaches_df['position'].dropna().unique())
        
        self.coach_statuses = list(coach_statuses) if coach_statuses else ['Full Time', 'Part Time', 'Branch Manager']
        print(f"    Coach statuses found: {self.coach_statuses}")
        
        # Extract level qualification columns
        self.qualification_columns = db.session.query(Level.name).order_by(Level.id).all()
        print(f"    Qualification columns defined: {self.qualification_columns}")
        
        # Set business constants from description and data
        self._derive_business_constants()
    
    def _derive_business_constants(self):
        """Derive business constants from description and database data"""
        
        # Class capacities from database or business rules
        self.class_capacities = {}
        levels = Level.query.all()
        for level_obj in levels:
            level_name = level_obj.name
            # Map level names from DB to expected format if needed
            if level_name == "BearyTots":
                key = "Tots"
            elif level_name.startswith("L"):
                key = level_name
            else:
                key = level_name
                
            self.class_capacities[key] = level_obj.max_students
        
        # Fill in missing capacities from business rules
        for level in self.all_levels:
            if level not in self.class_capacities:
                if level == 'Tots':  # BearyTots = 7
                    self.class_capacities[level] = 7
                elif level in ['Jolly', 'Bubbly', 'Lively', 'Flexi', 'L1']:  # = 8
                    self.class_capacities[level] = 8
                elif level == 'L2':  # = 9
                    self.class_capacities[level] = 9
                elif level in ['L3', 'L4', 'Advance', 'Free']:  # = 10
                    self.class_capacities[level] = 10
                else:
                    self.class_capacities[level] = 8  # Default
        
        # Class durations from database or business rules
        self.class_durations = {}
        for level_obj in levels:
            level_name = level_obj.name
            # Map level names from DB to expected format if needed
            if level_name == "BearyTots":
                key = "Tots"
            elif level_name.startswith("L"):
                key = level_name
            else:
                key = level_name
                
            self.class_durations[key] = level_obj.duration * 30  # Convert to minutes
        

        # Fill in missing durations from business rules
        for level in self.all_levels:
            if level not in self.class_durations or level in ['Advance', 'Free']:
                if level in ['Tots', 'Jolly', 'Bubbly', 'Lively', 'Flexi']:
                    self.class_durations[level] = 60  # 1 hour
                elif level in ['L1', 'L2', 'L3', 'L4', 'Advance', 'Free']:
                    self.class_durations[level] = 90  # 1.5 hours
                else:
                    self.class_durations[level] = 60  # Default fallback
        
        # Operating hours from business rules
        self.operating_hours = {
            'TUE': [('15:00', '19:00')],  # 3pm-7pm
            'WED': [('10:00', '12:00'), ('14:00', '19:00')],  # 10am-7pm with lunch break
            'THU': [('10:00', '12:00'), ('14:00', '19:00')],
            'FRI': [('10:00', '12:00'), ('14:00', '19:00')],
            'SAT': [('08:30', '18:30')],  # 8:30am-6:30pm
            'SUN': [('08:30', '18:30')]
        }
        
        # Branch limits from branch_config DB or DataFrame
        self.branch_limits = {}
        for _, row in self.branch_config_df.iterrows():
            branch = str(row['branch']).upper()
            max_classes = int(row['max_classes_per_slot'])
            self.branch_limits[branch] = max_classes
        
        # Workload limits from business rules
        self.workload_limits = {
            'Full Time': {
                'weekday': 3, 'weekend': 5, 'daily_hours': 7, 
                'consecutive': 3, 'min_break_after_consecutive': 30
            },
            'Part Time': {
                'weekday': 3, 'weekend': 5, 'daily_hours': 7, 
                'consecutive': 3, 'min_break_after_consecutive': 30
            },
            'Branch Manager': {
                'weekday': 3, 'weekend': 5, 'daily_hours': 7, 
                'consecutive': 3, 'min_break_after_consecutive': 30
            }
        }
        
        # Level hierarchy from business rules
        self.level_hierarchy = ['Tots', 'Jolly', 'Bubbly', 'Lively', 'Flexi', 'L1', 'L2', 'L3', 'L4', 'Advance', 'Free']
        
        print(f"    Class capacities derived: {self.class_capacities}")
        print(f"    Class durations derived: {self.class_durations}")
        print(f"    Branch limits from DB: {self.branch_limits}")
        print(f"    Operating hours defined: {list(self.operating_hours.keys())}")
    
    def _process_coaches_from_data(self):
        """Process coaches completely from database data"""
        coaches = {}
        
        # Build availability lookup from availability_df
        availability_lookup = defaultdict(lambda: defaultdict(bool))
        for _, row in self.availability_df.iterrows():
            coach_id = int(row['coach_id'])
            day = str(row['day']).upper()
            period = str(row['period']).lower()
            available = bool(row['available'])
            availability_lookup[coach_id][f"{day}_{period}"] = available
        
        # Process each coach from coaches_df
        for _, coach_row in self.coaches_df.iterrows():
            coach_id = int(coach_row['coach_id'])
            
            # Basic information from data
            name = str(coach_row.get('coach_name', f'Coach {coach_id}'))
            status = str(coach_row.get('status', 'Part Time')).strip()
            position = str(coach_row.get('position', '')).strip()
            residential_area = str(coach_row.get('residential_area', ''))
            
            # Determine final status from data
            if 'Manager' in position:
                final_status = 'Branch Manager'
            elif 'Full time' in status:
                final_status = 'Full Time'
            elif 'Part time' in status:
                final_status = 'Part Time'
            else:
                final_status = 'Part Time'  # Default
            
            # Extract qualifications from direct qualification columns
            qualifications = []
            qualification_mapping = {
                'BearyTots': 'Tots',
                'Jolly': 'Jolly',
                'Bubbly': 'Bubbly', 
                'Lively': 'Lively',
                'Flexi': 'Flexi',
                'Level_1': 'L1',
                'Level_2': 'L2',
                'Level_3': 'L3',
                'Level_4': 'L4',
                'Advance': 'Advance',
                'Free': 'Free'
            }
            
            for col, level in qualification_mapping.items():
                if col in coach_row and coach_row[col]:
                    qualifications.append(level)
            
            # Auto-add Free if has Advance (business rule)
            if 'Advance' in qualifications and 'Free' not in qualifications:
                qualifications.append('Free')
            
            # Extract branch assignments from data
            branches = []
            if 'assigned_branch' in coach_row and pd.notna(coach_row['assigned_branch']):
                branch_str = str(coach_row['assigned_branch'])
                for branch in branch_str.replace(',', ' ').split():
                    branch = branch.strip().upper()
                    if branch in self.all_branches:
                        branches.append(branch)
            
            # Build availability dictionary from data
            availability = {}
            for day in self.all_days:
                availability[day] = {
                    'am': availability_lookup[coach_id].get(f"{day}_am", False),
                    'pm': availability_lookup[coach_id].get(f"{day}_pm", False)
                }
            
            coaches[coach_id] = {
                'id': coach_id,
                'name': name,
                'status': final_status,
                'position': position,
                'residential_area': residential_area,
                'qualifications': qualifications,
                'branches': branches,
                'availability': availability,
                'workload_limits': self.workload_limits[final_status].copy(),
                'raw_data': dict(coach_row)
            }
        
        return coaches
    
    # The rest of the methods remain the same from the previous implementation
    
    def _process_requirements_from_data(self):
        """Process requirements directly from enrollment data"""
        requirements = []
        
        for _, row in self.enrollment_df.iterrows():
            branch = str(row['Branch']).upper()
            level = str(row['Level Category Base'])
            students = int(row['Count'])
            
            if branch in self.all_branches and level in self.all_levels and students > 0:
                requirements.append({
                    'branch': branch,
                    'level': level,
                    'students': students,
                    'capacity': self.class_capacities.get(level, 8),
                    'duration': self.class_durations.get(level, 90),
                    'raw_data': dict(row)
                })
        
        return requirements
    
    def _process_popular_timeslots_from_data(self):
        """Process popular timeslots directly from database"""
        popular_slots = set()
        
        print("  Processing popular timeslots from data:")
        for _, row in self.popular_df.iterrows():
            level = str(row['level'])
            day = str(row['day']).upper()
            time_slot = str(row['time_slot']).strip()
            
            if level in self.all_levels and day in self.all_days:
                popular_slots.add((level, day, time_slot))
        
        print(f"    Processed {len(popular_slots)} popular timeslot combinations")
        
        # Show distribution by level
        by_level = defaultdict(int)
        for level, day, time_slot in popular_slots:
            by_level[level] += 1
        
        print("    Popular slots by level:")
        for level in self.level_hierarchy:
            if level in self.all_levels:
                count = by_level[level]
                print(f"      {level}: {count} popular slots")
        
        return popular_slots
    
    def _generate_timeslots_from_operating_hours(self):
        """Generate all valid timeslots from operating hours"""
        timeslots = []
        
        for level in self.all_levels:
            duration = self.class_durations[level]
            
            for day in self.all_days:
                if day not in self.operating_hours:
                    continue
                
                for period_start, period_end in self.operating_hours[day]:
                    start_dt = datetime.strptime(period_start, '%H:%M')
                    end_dt = datetime.strptime(period_end, '%H:%M')
                    
                    # Generate 30-minute intervals
                    current = start_dt
                    while current + timedelta(minutes=duration) <= end_dt:
                        slot_start = current.strftime('%H:%M')
                        slot_end = (current + timedelta(minutes=duration)).strftime('%H:%M')
                        
                        # Check lunch break on weekdays (12:00-14:00)
                        valid_slot = True
                        if day in self.weekdays:
                            class_start = current
                            class_end = current + timedelta(minutes=duration)
                            lunch_start = datetime.strptime('12:00', '%H:%M')
                            lunch_end = datetime.strptime('14:00', '%H:%M')
                            
                            # Skip if overlaps with lunch
                            if not (class_end <= lunch_start or class_start >= lunch_end):
                                valid_slot = False
                        
                        if valid_slot:
                            period = 'am' if current.hour < 12 else 'pm'
                            time_slot_str = f"{slot_start}-{slot_end}"
                            
                            # Check if this timeslot is popular
                            is_popular = self._is_popular_timeslot(level, day, time_slot_str)
                            
                            timeslots.append({
                                'level': level,
                                'day': day,
                                'start_time': slot_start,
                                'end_time': slot_end,
                                'duration': duration,
                                'period': period,
                                'is_popular': is_popular,
                                'time_slot_str': time_slot_str
                            })
                        
                        current += timedelta(minutes=30)
        
        # Statistics
        total_slots = len(timeslots)
        popular_slots = len([ts for ts in timeslots if ts['is_popular']])
        print(f"  Generated {total_slots} total timeslots from operating hours")
        if total_slots > 0:
            print(f"  Popular timeslots: {popular_slots} ({popular_slots/total_slots*100:.1f}%)")
        else:
            print("  No timeslots generated - check operating hours and level data")
        
        return timeslots
    
    def _is_popular_timeslot(self, level, day, time_slot_str):
        """Check if a timeslot is popular based on data"""
        # Direct match
        if (level, day, time_slot_str) in self.popular_timeslots_set:
            return True
        
        # Check if falls within any popular time range
        try:
            current_start = datetime.strptime(time_slot_str.split('-')[0], '%H:%M')
            current_end = datetime.strptime(time_slot_str.split('-')[1], '%H:%M')
            
            for pop_level, pop_day, pop_time_slot in self.popular_timeslots_set:
                if pop_level == level and pop_day == day and '-' in pop_time_slot:
                    try:
                        pop_start = datetime.strptime(pop_time_slot.split('-')[0], '%H:%M')
                        pop_end = datetime.strptime(pop_time_slot.split('-')[1], '%H:%M')
                        
                        # Check if current slot falls within popular range
                        if pop_start <= current_start and current_end <= pop_end:
                            return True
                    except ValueError:
                        # Skip invalid time format
                        continue
        except ValueError:
            # Skip if current time slot has invalid format
            pass
        
        return False
    
    def _generate_feasible_assignments_from_data(self):
        """Generate feasible assignments based on all data constraints"""
        assignments = []
        assignment_id = 0
        
        for requirement in self.requirements_data:
            req_branch = requirement['branch']
            req_level = requirement['level']
            req_duration = requirement['duration']
            
            # Find qualified coaches from data
            qualified_coaches = []
            for coach_id, coach in self.coaches_data.items():
                if (req_level in coach['qualifications'] and 
                    req_branch in coach['branches']):
                    qualified_coaches.append(coach_id)
            
            # Find matching timeslots
            matching_timeslots = []
            for timeslot in self.timeslots_data:
                if (timeslot['level'] == req_level and 
                    timeslot['duration'] == req_duration):
                    matching_timeslots.append(timeslot)
            
            # Create assignments
            for coach_id in qualified_coaches:
                coach = self.coaches_data[coach_id]
                
                for timeslot in matching_timeslots:
                    day = timeslot['day']
                    period = timeslot['period']
                    
                    # Check coach availability from data
                    if coach['availability'][day][period]:
                        assignments.append({
                            'id': assignment_id,
                            'coach_id': coach_id,
                            'coach_name': coach['name'],
                            'coach_status': coach['status'],
                            'branch': req_branch,
                            'level': req_level,
                            'day': day,
                            'start_time': timeslot['start_time'],
                            'end_time': timeslot['end_time'],
                            'duration': timeslot['duration'],
                            'period': period,
                            'is_popular': timeslot['is_popular'],
                            'capacity': requirement['capacity'],
                            'students_available': requirement['students']
                        })
                        assignment_id += 1
        
        return assignments
    
    def _package_comprehensive_data(self):
        """Package all data comprehensively"""
        
        # Create enrollment dictionary
        enrollment_dict = {}
        for req in self.requirements_data:
            key = (req['branch'], req['level'])
            enrollment_dict[key] = req['students']
        
        # Create coach lookups
        coach_names = {coach_id: coach['name'] for coach_id, coach in self.coaches_data.items()}
        coach_status = {coach_id: coach['status'] for coach_id, coach in self.coaches_data.items()}
        
        # Calculate statistics
        total_students = sum(enrollment_dict.values())
        popular_assignments = [a for a in self.feasible_assignments if a['is_popular']]
        
        # Analyze coverage potential
        coverage_analysis = self._analyze_coverage_potential(enrollment_dict, popular_assignments)
        
        print(f"\nDATA-DRIVEN ANALYSIS:")
        print(f"  Total students from enrollment data: {total_students}")
        print(f"  Total assignments generated: {len(self.feasible_assignments)}")
        if self.feasible_assignments:
            print(f"  Popular assignments: {len(popular_assignments)} ({len(popular_assignments)/len(self.feasible_assignments)*100:.1f}%)")
        else:
            print("  No feasible assignments generated - check coach qualifications and availability")
        
        if coverage_analysis['uncoverable_requirements']:
            print(f"  Requirements needing attention: {len(coverage_analysis['uncoverable_requirements'])}")
            for item in coverage_analysis['uncoverable_requirements'][:3]:
                req = item['requirement']
                print(f"    {req[0]} {req[1]}: needs {item['demand']}, popular capacity {item['capacity']}")
        else:
            print("  ✓ All requirements can be covered with popular timeslots")
        
        return {
            # Core data from database
            'enrollment_dict': enrollment_dict,
            'coach_names': coach_names,
            'coach_status': coach_status,
            'coaches_data': self.coaches_data,
            'requirements_data': self.requirements_data,
            'timeslots_data': self.timeslots_data,
            'feasible_assignments': self.feasible_assignments,
            
            # Business rules from data/description
            'class_capacities': self.class_capacities,
            'class_durations': self.class_durations,
            'branch_limits': self.branch_limits,
            'workload_limits': self.workload_limits,
            'operating_hours': self.operating_hours,
            'level_hierarchy': self.level_hierarchy,
            
            # Extracted from data
            'all_branches': self.all_branches,
            'all_levels': self.all_levels,
            'all_days': self.all_days,
            'weekdays': self.weekdays,
            'weekends': self.weekends,
            'coach_statuses': self.coach_statuses,
            
            # Comprehensive statistics
            'total_students': total_students,
            'total_coaches': len(self.coaches_data),
            'total_requirements': len(self.requirements_data),
            'total_timeslots': len(self.timeslots_data),
            'total_feasible_assignments': len(self.feasible_assignments),
            'popular_assignments_count': len(popular_assignments),
            'coverage_analysis': coverage_analysis
        }
    
    def _analyze_coverage_potential(self, enrollment_dict, popular_assignments):
        """Analyze coverage potential with popular assignments"""
        analysis = {
            'total_demand': sum(enrollment_dict.values()),
            'popular_capacity': 0,
            'coverage_by_requirement': {},
            'uncoverable_requirements': []
        }
        
        # Calculate capacity by requirement
        capacity_by_req = defaultdict(int)
        for assignment in popular_assignments:
            key = (assignment['branch'], assignment['level'])
            capacity_by_req[key] += assignment['capacity']
        
        analysis['popular_capacity'] = sum(capacity_by_req.values())
        
        # Analyze each requirement
        for key, demand in enrollment_dict.items():
            popular_capacity = capacity_by_req.get(key, 0)
            
            analysis['coverage_by_requirement'][key] = {
                'demand': demand,
                'popular_capacity': popular_capacity,
                'gap': max(0, demand - popular_capacity)
            }
            
            if popular_capacity < demand:
                analysis['uncoverable_requirements'].append({
                    'requirement': key,
                    'demand': demand,
                    'capacity': popular_capacity,
                    'gap': demand - popular_capacity
                })
        
        return analysis

def load_database_driven():
    """
    Load data using completely data-driven processor from database
    
    Returns:
        Complete data package with everything extracted from database
    """
    processor = DataDrivenProcessor()
    return processor.load_and_process_data()