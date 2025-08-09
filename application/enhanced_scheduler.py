import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict
import random

class EnhancedStrictConstraintScheduler:
    """
    Enhanced Strict Constraint Scheduler - Optimizes student assignment with strict workload limits
    
    Algorithm Overview:
    1. Systematic assignment by priority (scarcity-based)
    2. Gap filling for unmet requirements
    3. Level merging to maximize capacity utilization
    4. Multi-level combinations for complex gaps
    5. Exhaustive assignment using all available resources
    6. Maximum utilization within strict constraints
    """
    
    # ==================== EDITABLE CONFIGURATION ====================
    
    # Workload Limits (STRICT - never exceeded)
    WEEKEND_DAILY_LIMIT = 5        # Max classes per coach per weekend day
    WEEKDAY_DAILY_LIMIT = 3        # Max classes per coach per weekday
    WEEKEND_DAILY_HOURS = 480      # Max minutes per coach per weekend day (8 hours)
    WEEKDAY_DAILY_HOURS = 240      # Max minutes per coach per weekday (4 hours)
    
    # Weekly Workload Limits by Coach Type
    FULL_TIME_WEEKLY_MAX = 25      # Max classes per week for full-time coaches
    PART_TIME_WEEKLY_MAX = 15      # Max classes per week for part-time coaches
    MANAGER_WEEKLY_MAX = 3         # Max classes per week for branch managers
    
    # Class Management Rules
    CONSECUTIVE_LIMIT = 3          # Max consecutive classes without break
    MIN_BREAK_MINUTES = 60         # Minimum break between consecutive classes
    LEVEL_MERGE_DISTANCE = 1       # Max levels apart for merging (1 = adjacent only)
    MIN_MERGE_SIZE = 3             # Minimum students to create multi-level class
    
    # Algorithm Behavior
    MAX_ITERATIONS = 60            # Number of optimization iterations
    SHUFFLE_INTERVAL = 5           # Shuffle assignments every N iterations
    MAX_ASSIGNMENT_ATTEMPTS = 20   # Max attempts per requirement
    
    # Scoring Weights (1-10 scale, higher = more preferred)
    WEEKEND_BIAS = 5               # Weekend preference (1-10)
    WEEKDAY_BIAS = 0               # Weekday preference (0-10)
    UNDERUTILIZED_COACH_BONUS = 7  # Priority for full-time coaches with fewer classes (1-10)
    NO_TURNAROUND_BONUS = 5        # Priority for scheduling classes back-to-back (1-10)
    DIVERSE_CLASS_BONUS = 3        # Priority for coaches teaching diverse class levels (1-10)
    SAME_PROGRAM_BACK_TO_BACK_PENALTY = 6  # Penalty for same program back-to-back on weekday mornings (1-10)
    
    # Priority Weights (1-10 scale, automatically normalized)
    SCARCITY_WEIGHT = 5            # Priority for resource scarcity (1-10)
    COMPLEXITY_WEIGHT = 3          # Priority for level complexity (1-10)
    SIZE_WEIGHT = 2                # Priority for enrollment size (1-10)
    
    # Fixed internal parameters (not user-adjustable)
    _CAPACITY_MULTIPLIER = 2.0     # Default capacity multiplier value
    _PEAK_HOURS_BONUS = 8          # Priority for 10AM-3PM slots
    _GOOD_HOURS_BONUS = 6          # Priority for 9AM-5PM slots
    
    # ==================== END EDITABLE CONFIGURATION ====================
    
    def __init__(self, data, config:dict =None):
        if config:
            for key, value in config.items():
                if hasattr(self, key.upper()):
                    setattr(self, key.upper(), value)
        
        print("ENHANCED STRICT CONSTRAINT SCHEDULER")
        print("Target: Maximum student assignment with strict workload limits")
        print(f"STRICT LIMIT: Max {self.WEEKEND_DAILY_LIMIT} classes per coach per weekend day")
        print(f"STRICT LIMIT: Max {self.WEEKDAY_DAILY_LIMIT} classes per coach per weekday")

        self.data = data
        self.enrollment_dict = data['enrollment_dict']
        self.coaches_data = data['coaches_data']
        self.feasible_assignments = data['feasible_assignments']
        
        # Use only popular assignments
        self.popular_assignments = [a for a in self.feasible_assignments if a.get('is_popular', False)]
        
        if len(self.popular_assignments) == 0:
            print("WARNING: No popular assignments found. Using all feasible assignments.")
            self.popular_assignments = self.feasible_assignments
        
        print(f"Popular assignments available: {len(self.popular_assignments)}")
        print(f"Only using popular timeslots for scheduling")
        
        # Load constraints and hierarchy
        self.class_capacities = data['class_capacities']
        self.branch_limits = data['branch_limits']
        self.level_hierarchy = ['Tots', 'Jolly', 'Bubbly', 'Lively', 'Flexi', 'L1', 'L2', 'L3', 'L4', 'Advance', 'Free']
        self.weekdays = data['weekdays']
        self.weekends = data['weekends']
        
        # Define programs for the same_program_back_to_back penalty
        self.program_groups = {
            'Tots': 'Tots',
            'Jolly': 'Jolly',
            'Bubbly': 'Bubbly',
            'Lively': 'Lively',
            'Flexi': 'Flexi',
            'L1': 'Level',
            'L2': 'Level',
            'L3': 'Level',
            'L4': 'Level',
            'Advance': 'Advanced',
            'Free': 'Advanced'
        }
        
        # Define morning hours (before 12pm) for same program back to back penalty
        self.morning_hours = list(range(9, 12))
        
        self.total_students_required = sum(self.enrollment_dict.values())
        
        # Categorize coaches by type
        self.full_time_coaches = [c for c in self.coaches_data.values() if c['status'] == 'Full Time']
        self.part_time_coaches = [c for c in self.coaches_data.values() if c['status'] == 'Part Time']
        self.branch_managers = [c for c in self.coaches_data.values() if c['status'] == 'Branch Manager']
        
        print(f"Total students to schedule: {self.total_students_required}")
        print(f"Coaches: {len(self.full_time_coaches)} FT, {len(self.part_time_coaches)} PT, {len(self.branch_managers)} MGR")
        
        self._analyze_enrollment_requirements()
        
        # Calculate theoretical capacity
        self.theoretical_capacity = self._calculate_theoretical_capacity()
        print(f"Theoretical maximum capacity (strict limits): {self.theoretical_capacity}")
        
        if self.theoretical_capacity < self.total_students_required:
            print("WARNING: Theoretical capacity insufficient with strict workload limits")
            print("Will maximize coverage within constraints")
        
        # Normalize priority weights for calculations (scale of 0-10 to proportions)
        total_weight = self.SCARCITY_WEIGHT + self.COMPLEXITY_WEIGHT + self.SIZE_WEIGHT
        if total_weight > 0:
            self.scarcity_weight_normalized = self.SCARCITY_WEIGHT / total_weight
            self.complexity_weight_normalized = self.COMPLEXITY_WEIGHT / total_weight
            self.size_weight_normalized = self.SIZE_WEIGHT / total_weight
        else:
            # Default to equal weights if all are zero
            self.scarcity_weight_normalized = 0.33
            self.complexity_weight_normalized = 0.33
            self.size_weight_normalized = 0.34
    
    def _analyze_enrollment_requirements(self):
        """Analyze enrollment requirements and identify potential bottlenecks"""
        print("\nAnalyzing enrollment requirements:")
        
        for req_key, students in self.enrollment_dict.items():
            branch, level = req_key
            
            qualified_coaches = len([c for c in self.full_time_coaches + self.part_time_coaches + self.branch_managers
                                   if level in c['qualifications'] and branch in c['branches']])
            
            popular_slots = len([a for a in self.popular_assignments 
                               if a['branch'] == branch and a['level'] == level])
            
            print(f"  {branch} {level}: {students} students, {qualified_coaches} coaches, {popular_slots} popular slots")
            
            if students > 0 and (qualified_coaches == 0 or popular_slots == 0):
                print(f"    WARNING: Critical shortage for {branch} {level}")
    
    def schedule_with_complete_coverage(self):
        """Main scheduling algorithm with strict constraint enforcement"""
        print("\nStarting enhanced scheduling with strict workload enforcement...")
        print(f"CONSTRAINT: Never exceed {self.WEEKEND_DAILY_LIMIT} weekend / {self.WEEKDAY_DAILY_LIMIT} weekday classes per coach per day")
        print("STRATEGY: Maximize coverage within absolute limits")
        print("NOTE: Only using popular timeslots for scheduling")
        
        best_result = None
        best_coverage = 0
        
        for iteration in range(1, self.MAX_ITERATIONS + 1):
            print(f"\nITERATION {iteration}")
            print("-" * 40)
            
            state = self._initialize_enhanced_state()
            
            # Always use popular slots only
            assignment_pool = self.popular_assignments
            print(f"Using POPULAR slots only for maximum coverage")
            
            # Execute six-phase optimization
            self._phase1_enhanced_systematic(state, assignment_pool)
            self._phase2_enhanced_gap_filling(state, assignment_pool)
            self._phase3_enhanced_merging(state)
            self._phase4_multi_level_merging(state, assignment_pool)
            self._phase5_exhaustive_assignment(state, assignment_pool)
            self._phase6_maximum_utilization_strict(state, assignment_pool)
            
            # Validate and score result
            result = self._build_and_validate_result(state)
            coverage = result['statistics']['coverage_percentage']
            violations = self._count_violations(result)
            workload_violations = self._count_workload_violations(result)
            
            print(f"Result: {coverage:.1f}% coverage, {violations} violations, {workload_violations} workload violations")
            
            # Accept only zero-violation results
            if violations == 0 and workload_violations == 0 and coverage > best_coverage:
                best_result = result
                best_coverage = coverage
                print(f"New best VALID result: {coverage:.1f}% (strict limits enforced)")
            elif workload_violations > 0:
                print(f"REJECTED: {workload_violations} workload limit violations")
            elif violations > 0:
                print(f"REJECTED: {violations} other constraint violations")
            
            # Check for perfect solution
            if coverage >= 100.0 and violations == 0 and workload_violations == 0:
                print("100% coverage with zero violations achieved - SUCCESS")
                break
            
            # Report remaining gaps
            gaps = self._identify_gaps(result)
            if gaps:
                unassigned_total = sum(gap for _, gap in gaps)
                print(f"Remaining unassigned: {unassigned_total} students")
                if len(gaps) <= 5:
                    print("Critical gaps:")
                    for req_key, gap in gaps:
                        print(f"  {req_key[0]} {req_key[1]}: {gap} students")
            
            # Periodic shuffling for better exploration
            if iteration % self.SHUFFLE_INTERVAL == 0:
                self._enhanced_adaptive_shuffle()
        
        # Return best valid result or fallback
        final_result = best_result if best_result else self._create_best_effort_strict_result()
        final_coverage = final_result['statistics']['coverage_percentage']
        
        print(f"\nFINAL RESULT: {final_coverage:.1f}% coverage with strict workload limits")
        
        if final_coverage >= 100.0:
            print("SUCCESS: 100% coverage within strict workload limits")
        else:
            remaining = final_result['statistics']['total_students_required'] - final_result['statistics']['total_students_scheduled']
            print(f"RESULT: {remaining} students unassigned due to strict workload constraints")
            print("GUARANTEE: All workload limits strictly respected")
            print("\nPossible solutions to improve coverage:")
            print("1. Increase WEEKEND_DAILY_LIMIT (currently " + str(self.WEEKEND_DAILY_LIMIT) + ")")
            print("2. Increase WEEKDAY_DAILY_LIMIT (currently " + str(self.WEEKDAY_DAILY_LIMIT) + ")")
            print("3. Increase weekly limits (especially for full-time coaches)")
            print("4. Adjust CONSECUTIVE_LIMIT to allow more classes in succession")
        
        # Print detailed summary of the scheduling results
        self._print_scheduling_summary(final_result)
        
        return final_result
    
    def _print_scheduling_summary(self, result):
        """Print comprehensive summary of scheduling results"""
        print("\n" + "="*80)
        print("SCHEDULING SUMMARY")
        print("="*80)
        
        stats = result['statistics']
        schedule = result['schedule']
        
        # Overall statistics
        print(f"Total Students Scheduled: {stats['total_students_scheduled']} of {stats['total_students_required']} ({stats['coverage_percentage']:.1f}%)")
        print(f"Total Classes Scheduled: {stats['total_classes']}")
        print(f"Popular Timeslots Used: {stats['popular_slots_used']} of {stats['total_slots']} classes ({stats['popular_slots_used']/max(1, stats['total_slots'])*100:.1f}%)")
        print(f"Merged Classes: {stats['merged_classes']}")
        
        # Branch distribution
        branch_classes = {}
        branch_students = {}
        for entry in schedule:
            branch = entry['Branch']
            if branch not in branch_classes:
                branch_classes[branch] = 0
                branch_students[branch] = 0
            branch_classes[branch] += 1
            branch_students[branch] += entry['Students']
        
        print("\nBranch Distribution:")
        for branch in sorted(branch_classes.keys()):
            class_count = branch_classes[branch]
            student_count = branch_students[branch]
            print(f"  {branch}: {class_count} classes, {student_count} students")
        
        # Coach utilization
        coach_usage = {}
        coach_classes = {}
        for entry in schedule:
            coach_id = entry['Coach ID']
            coach_name = entry['Coach Name']
            coach_status = entry['Coach Status']
            
            if coach_id not in coach_classes:
                coach_classes[coach_id] = 0
                coach_usage[coach_id] = {'name': coach_name, 'status': coach_status, 'classes': 0, 'students': 0}
            
            coach_classes[coach_id] += 1
            coach_usage[coach_id]['classes'] += 1
            coach_usage[coach_id]['students'] += entry['Students']
        
        # Group coaches by status
        full_time_coaches = []
        part_time_coaches = []
        branch_managers = []
        
        for coach_id, data in coach_usage.items():
            status = data['status']
            if 'Full Time' in status:
                full_time_coaches.append((coach_id, data))
            elif 'Part Time' in status:
                part_time_coaches.append((coach_id, data))
            else:
                branch_managers.append((coach_id, data))
        
        # Sort each group by number of classes (descending)
        full_time_coaches.sort(key=lambda x: x[1]['classes'], reverse=True)
        part_time_coaches.sort(key=lambda x: x[1]['classes'], reverse=True)
        branch_managers.sort(key=lambda x: x[1]['classes'], reverse=True)
        
        print("\nCoach Utilization:")
        print("  Full Time Coaches:")
        for coach_id, data in full_time_coaches:
            print(f"    {data['name']} (ID {coach_id}): {data['classes']} classes, {data['students']} students")
        
        print("  Part Time Coaches:")
        for coach_id, data in part_time_coaches:
            print(f"    {data['name']} (ID {coach_id}): {data['classes']} classes, {data['students']} students")
        
        print("  Branch Managers:")
        for coach_id, data in branch_managers:
            print(f"    {data['name']} (ID {coach_id}): {data['classes']} classes, {data['students']} students")
        
        # Level distribution
        level_distribution = {}
        for entry in schedule:
            level = entry['Gymnastics Level']
            if level not in level_distribution:
                level_distribution[level] = {'classes': 0, 'students': 0}
            level_distribution[level]['classes'] += 1
            level_distribution[level]['students'] += entry['Students']
        
        print("\nLevel Distribution:")
        for level in self.level_hierarchy:
            if level in level_distribution:
                print(f"  {level}: {level_distribution[level]['classes']} classes, {level_distribution[level]['students']} students")
        
        # Day distribution
        day_distribution = {}
        for entry in schedule:
            day = entry['Day']
            if day not in day_distribution:
                day_distribution[day] = {'classes': 0, 'students': 0}
            day_distribution[day]['classes'] += 1
            day_distribution[day]['students'] += entry['Students']
        
        print("\nDay Distribution:")
        for day in sorted(day_distribution.keys()):
            print(f"  {day}: {day_distribution[day]['classes']} classes, {day_distribution[day]['students']} students")
        
        # Calculate time distribution
        morning_classes = 0
        afternoon_classes = 0
        evening_classes = 0
        
        for entry in schedule:
            start_time = entry['Start Time']
            hour = int(start_time.split(':')[0])
            
            if hour < 12:
                morning_classes += 1
            elif hour < 17:
                afternoon_classes += 1
            else:
                evening_classes += 1
        
        print("\nTime Distribution:")
        print(f"  Morning (before 12PM): {morning_classes} classes")
        print(f"  Afternoon (12-5PM): {afternoon_classes} classes")
        print(f"  Evening (after 5PM): {evening_classes} classes")
        
        # Check for same-program back-to-back classes on weekday mornings
        same_program_b2b = self._count_same_program_back_to_back(schedule)
        if same_program_b2b:
            print("\nSame Program Back-to-Back Classes on Weekday Mornings:")
            for item in same_program_b2b[:5]:  # Show top 5
                branch, day, program, start_times = item
                print(f"  {branch} {day}: {program} program at {', '.join(start_times)}")
            
            if len(same_program_b2b) > 5:
                print(f"  ...and {len(same_program_b2b) - 5} more instances")
        
        print("="*80)
    
    def _count_same_program_back_to_back(self, schedule):
        """Count instances of same program back-to-back classes on weekday mornings"""
        # Group by branch, day, coach
        groups = defaultdict(list)
        for entry in schedule:
            if entry['Day'] in self.weekdays:  # Only weekdays
                hour = int(entry['Start Time'].split(':')[0])
                if hour in self.morning_hours:  # Only morning hours
                    key = (entry['Branch'], entry['Day'], entry['Coach ID'])
                    level = entry['Gymnastics Level']
                    program = self.program_groups.get(level, level)
                    groups[key].append({
                        'program': program,
                        'level': level,
                        'start_time': entry['Start Time']
                    })
        
        # Find back-to-back same program
        same_program_b2b = []
        for (branch, day, coach), classes in groups.items():
            if len(classes) < 2:
                continue
            
            # Sort by start time
            classes.sort(key=lambda x: x['start_time'])
            
            # Group consecutive classes by program
            program_groups = defaultdict(list)
            for i in range(len(classes)):
                class_info = classes[i]
                program = class_info['program']
                program_groups[program].append(class_info['start_time'])
            
            # Check for programs with multiple consecutive classes
            for program, times in program_groups.items():
                if len(times) >= 2:
                    same_program_b2b.append((branch, day, program, times))
        
        return same_program_b2b
    
    def _calculate_theoretical_capacity(self):
        """Calculate maximum theoretical capacity with strict constraints"""
        total_capacity = 0
        
        for coach in self.full_time_coaches + self.part_time_coaches + self.branch_managers:
            coach_capacity = 0
            
            # Calculate daily capacity with strict limits
            for day in ['TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']:
                daily_classes = self.WEEKEND_DAILY_LIMIT if day in self.weekends else self.WEEKDAY_DAILY_LIMIT
                coach_capacity += daily_classes
            
            # Apply weekly limits by coach type
            weekly_limit = self._get_coach_weekly_limit(coach)
            coach_capacity = min(coach_capacity, weekly_limit)
            
            total_capacity += coach_capacity
        
        # Apply average class capacity
        average_class_capacity = sum(self.class_capacities.values()) / len(self.class_capacities)
        return int(total_capacity * average_class_capacity)
    
    def _get_coach_weekly_limit(self, coach):
        """Get weekly class limit based on coach type"""
        status = coach['status']
        if status == 'Full Time':
            return self.FULL_TIME_WEEKLY_MAX
        elif status == 'Part Time':
            return self.PART_TIME_WEEKLY_MAX
        else:  # Branch Manager
            return self.MANAGER_WEEKLY_MAX
    
    def _initialize_enhanced_state(self):
        """Initialize state tracking for scheduling iteration"""
        return {
            'selected_assignments': [],
            'coach_schedules': defaultdict(lambda: defaultdict(list)),
            'coach_daily_hours': defaultdict(lambda: defaultdict(int)),
            'coach_daily_classes': defaultdict(lambda: defaultdict(int)),
            'coach_branch_daily': defaultdict(lambda: defaultdict(str)),
            'branch_time_usage': defaultdict(lambda: defaultdict(lambda: defaultdict(int))),
            'requirement_coverage': defaultdict(int),
            'coach_workload': defaultdict(int),
            'coach_levels_taught': defaultdict(set),  # Track diversity of levels taught
            'unassigned_students': dict(self.enrollment_dict),
            'critical_gaps': [],
            'resource_utilization': defaultdict(float),
            'assignment_attempts': defaultdict(int),
            'coach_program_morning_classes': defaultdict(lambda: defaultdict(lambda: defaultdict(list)))  # Track morning program classes
        }
    
    def _phase1_enhanced_systematic(self, state, assignment_pool):
        """Phase 1: Systematic assignment by priority with strict constraint enforcement"""
        print("Phase 1: Enhanced systematic assignment (strict workload limits)")
        
        sorted_requirements = self._get_enhanced_priority_requirements()
        
        for req_key, requirement in sorted_requirements:
            branch, level = req_key
            students_needed = requirement['students']
            max_capacity = self.class_capacities.get(level, 8)
            
            print(f"  Processing {branch} {level}: {students_needed} students")
            
            students_assigned = 0
            qualified_coaches = self._get_prioritized_coaches(branch, level)
            attempts = 0
            
            while students_assigned < students_needed and attempts < self.MAX_ASSIGNMENT_ATTEMPTS:
                attempts += 1
                assignment = self._find_optimal_assignment_strict(qualified_coaches, branch, level, state, assignment_pool)
                
                if not assignment:
                    print(f"    No valid assignment found on attempt {attempts} (strict limits)")
                    break
                
                remaining_students = students_needed - students_assigned
                class_size = min(remaining_students, max_capacity)
                
                if self._add_validated_assignment_strict(assignment, class_size, state):
                    students_assigned += class_size
                    state['unassigned_students'][req_key] = students_needed - students_assigned
                    print(f"    Class added: {class_size} students, Coach {assignment['coach_name']}")
                else:
                    print(f"    Failed to add assignment (strict limits enforced)")
            
            if students_assigned > 0:
                coverage_rate = (students_assigned / students_needed * 100)
                print(f"    Coverage: {students_assigned}/{students_needed} ({coverage_rate:.1f}%)")
            else:
                print(f"    CONSTRAINT LIMITED: No students assigned for {branch} {level}")
                state['critical_gaps'].append(req_key)
        
        total_scheduled = sum(a['actual_students'] for a in state['selected_assignments'])
        coverage = (total_scheduled / self.total_students_required * 100)
        print(f"  Phase 1 Complete: {coverage:.1f}% total coverage")
    
    def _phase2_enhanced_gap_filling(self, state, assignment_pool):
        """Phase 2: Fill remaining gaps with additional classes"""
        print("Phase 2: Enhanced gap filling (strict workload limits)")
        
        gaps = [(k, v) for k, v in state['unassigned_students'].items() if v > 0]
        if not gaps:
            print("  No gaps to fill")
            return
        
        # Sort gaps by urgency (size and scarcity)
        gaps.sort(key=lambda x: (x[1], self._calculate_scarcity_score(x[0])), reverse=True)
        
        for req_key, gap_size in gaps:
            branch, level = req_key
            print(f"  Filling gap: {branch} {level} - {gap_size} students")
            
            all_qualified = self._get_all_qualified_coaches(branch, level)
            students_filled = 0
            
            for coach in all_qualified:
                if students_filled >= gap_size:
                    break
                
                assignment = self._find_specific_coach_assignment_strict(coach['id'], branch, level, state, assignment_pool)
                if assignment:
                    max_capacity = self.class_capacities.get(level, 8)
                    class_size = min(gap_size - students_filled, max_capacity)
                    
                    if self._add_validated_assignment_strict(assignment, class_size, state):
                        students_filled += class_size
                        state['unassigned_students'][req_key] -= class_size
                        print(f"    Gap filled: {class_size} students, Coach {coach['name']}")
            
            if students_filled == 0:
                print(f"    CONSTRAINT LIMITED: Could not fill gap for {branch} {level}")
        
        total_scheduled = sum(a['actual_students'] for a in state['selected_assignments'])
        coverage = (total_scheduled / self.total_students_required * 100)
        print(f"  Phase 2 Complete: {coverage:.1f}% total coverage")
    
    def _phase3_enhanced_merging(self, state):
        """Phase 3: Merge students from different levels into existing classes"""
        print("Phase 3: Enhanced merging")
        
        gaps = [(k, v) for k, v in state['unassigned_students'].items() if v > 0]
        if not gaps:
            print("  No gaps requiring merging")
            return
        
        for req_key, gap_size in gaps:
            branch, level = req_key
            print(f"  Merging for {branch} {level}: {gap_size} students")
            
            # Find compatible existing classes with available capacity
            compatible_classes = []
            for assignment in state['selected_assignments']:
                if (assignment['branch'] == branch and 
                    self._check_level_compatibility(assignment['level'], level)):
                    
                    current_students = assignment['actual_students']
                    max_capacity = self.class_capacities.get(assignment['level'], 8)
                    available_space = max_capacity - current_students
                    
                    if available_space > 0:
                        compatible_classes.append((assignment, available_space))
            
            # Sort by available space (largest first)
            compatible_classes.sort(key=lambda x: x[1], reverse=True)
            
            students_merged = 0
            for assignment, available_space in compatible_classes:
                if students_merged >= gap_size:
                    break
                
                merge_size = min(gap_size - students_merged, available_space)
                
                if merge_size > 0:
                    new_total = assignment['actual_students'] + merge_size
                    max_capacity = self.class_capacities.get(assignment['level'], 8)
                    
                    if new_total <= max_capacity:
                        assignment['actual_students'] += merge_size
                        students_merged += merge_size
                        self._update_merge_info(assignment, level)
                        print(f"    Merged {merge_size}: {assignment['level']}+{level}")
            
            if students_merged > 0:
                state['unassigned_students'][req_key] -= students_merged
                print(f"  Merge progress: {students_merged}/{gap_size} students merged")
        
        total_scheduled = sum(a['actual_students'] for a in state['selected_assignments'])
        coverage = (total_scheduled / self.total_students_required * 100)
        print(f"  Phase 3 Complete: {coverage:.1f}% total coverage")
    
    def _phase4_multi_level_merging(self, state, assignment_pool):
        """Phase 4: Create new classes combining multiple levels"""
        print("Phase 4: Multi-level merging")
        
        gaps = [(k, v) for k, v in state['unassigned_students'].items() if v > 0]
        if not gaps:
            print("  No gaps requiring multi-level merging")
            return
        
        # Group gaps by branch for efficient processing
        branch_gaps = defaultdict(list)
        for req_key, gap_size in gaps:
            branch, level = req_key
            branch_gaps[branch].append((level, gap_size))
        
        for branch, level_gaps in branch_gaps.items():
            print(f"  Multi-level merging for branch {branch}")
            
            level_combinations = self._generate_level_combinations(level_gaps)
            
            for levels, total_students in level_combinations:
                if total_students < self.MIN_MERGE_SIZE:
                    continue
                
                qualified_coaches = self._find_multi_qualified_coaches(branch, levels)
                
                for coach in qualified_coaches:
                    assignment = self._find_specific_coach_assignment_strict(coach['id'], branch, levels[0], state, assignment_pool)
                    
                    if assignment:
                        max_capacity = max(self.class_capacities.get(level, 8) for level in levels)
                        class_size = min(total_students, max_capacity)
                        
                        if self._add_validated_assignment_strict(assignment, class_size, state):
                            self._distribute_students_across_levels(levels, level_gaps, class_size, state)
                            assignment['merged_levels'] = levels
                            assignment['merged'] = 'Yes'
                            assignment['merged_with'] = '+'.join(sorted(levels))
                            
                            print(f"    Multi-level class: {'+'.join(levels)} - {class_size} students")
                            break
        
        total_scheduled = sum(a['actual_students'] for a in state['selected_assignments'])
        coverage = (total_scheduled / self.total_students_required * 100)
        print(f"  Phase 4 Complete: {coverage:.1f}% total coverage")
    
    def _phase5_exhaustive_assignment(self, state, assignment_pool):
        """Phase 5: Use every available coach slot within strict limits"""
        print("Phase 5: Exhaustive assignment (strict limits enforced)")
        
        gaps = [(k, v) for k, v in state['unassigned_students'].items() if v > 0]
        if not gaps:
            print("  No gaps requiring exhaustive assignment")
            return
        
        for coach in self.full_time_coaches + self.part_time_coaches + self.branch_managers:
            coach_id = coach['id']
            
            for day in ['TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']:
                current_classes = state['coach_daily_classes'][coach_id][day]
                max_classes = self.WEEKEND_DAILY_LIMIT if day in self.weekends else self.WEEKDAY_DAILY_LIMIT
                
                if current_classes < max_classes:
                    for req_key, gap_size in gaps:
                        branch, level = req_key
                        
                        if (gap_size > 0 and 
                            level in coach['qualifications'] and 
                            branch in coach['branches']):
                            
                            assignment = self._find_specific_coach_day_assignment_strict(
                                coach_id, branch, level, day, state, assignment_pool
                            )
                            
                            if assignment:
                                max_capacity = self.class_capacities.get(level, 8)
                                class_size = min(gap_size, max_capacity)
                                
                                if self._add_validated_assignment_strict(assignment, class_size, state):
                                    state['unassigned_students'][req_key] -= class_size
                                    print(f"    Exhaustive class: {class_size} students, Coach {coach['name']} on {day}")
                                    break
        
        total_scheduled = sum(a['actual_students'] for a in state['selected_assignments'])
        coverage = (total_scheduled / self.total_students_required * 100)
        print(f"  Phase 5 Complete: {coverage:.1f}% total coverage")
    
    def _phase6_maximum_utilization_strict(self, state, assignment_pool):
        """Phase 6: Final optimization to maximize utilization within strict limits"""
        print("Phase 6: Maximum utilization (strict limits)")
        
        gaps = [(k, v) for k, v in state['unassigned_students'].items() if v > 0]
        if not gaps:
            print("  No gaps - maximum coverage achieved within strict limits")
            return
        
        print(f"  Final optimization for {len(gaps)} remaining gaps")
        
        # Final push: use every remaining slot within strict limits
        for coach in self.full_time_coaches + self.part_time_coaches + self.branch_managers:
            coach_id = coach['id']
            
            for day in ['TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']:
                current_classes = state['coach_daily_classes'][coach_id][day]
                max_classes = self.WEEKEND_DAILY_LIMIT if day in self.weekends else self.WEEKDAY_DAILY_LIMIT
                
                while current_classes < max_classes:
                    assignment_added = False
                    
                    for req_key, gap_size in gaps:
                        if gap_size <= 0:
                            continue
                            
                        branch, level = req_key
                        
                        if (level in coach['qualifications'] and 
                            branch in coach['branches']):
                            
                            assignment = self._find_specific_coach_day_assignment_strict(
                                coach_id, branch, level, day, state, assignment_pool
                            )
                            
                            if assignment:
                                max_capacity = self.class_capacities.get(level, 8)
                                class_size = min(gap_size, max_capacity)
                                
                                if self._add_validated_assignment_strict(assignment, class_size, state):
                                    state['unassigned_students'][req_key] -= class_size
                                    current_classes += 1
                                    assignment_added = True
                                    print(f"    Max utilization: {class_size} students, Coach {coach['name']} {day}")
                                    break
                    
                    if not assignment_added:
                        break
        
        total_scheduled = sum(a['actual_students'] for a in state['selected_assignments'])
        coverage = (total_scheduled / self.total_students_required * 100)
        print(f"  Phase 6 Complete: {coverage:.1f}% total coverage")
        
        # Final gap report
        remaining_gaps = [(k, v) for k, v in state['unassigned_students'].items() if v > 0]
        if remaining_gaps:
            total_unassigned = sum(gap for _, gap in remaining_gaps)
            print(f"  {total_unassigned} students remain unassigned due to strict workload limits")
            for req_key, gap in remaining_gaps[:5]:
                print(f"    CONSTRAINED: {req_key[0]} {req_key[1]} - {gap} students")
        else:
            print("  100% ASSIGNMENT ACHIEVED within strict workload limits")
    
    # ==================== ASSIGNMENT SCORING AND SELECTION ====================
    
    def _score_assignment_enhanced(self, assignment, state):
        """Score assignment based on configured preferences (1-10 scale)"""
        score = 0
        
        # Time preferences (using internal fixed values)
        start_hour = int(assignment['start_time'].split(':')[0])
        if 10 <= start_hour <= 15:
            score += self._PEAK_HOURS_BONUS
        elif 9 <= start_hour <= 17:
            score += self._GOOD_HOURS_BONUS
        
        # Day preferences (using 1-10 scale)
        if assignment['day'] in self.weekends:
            score += self.WEEKEND_BIAS
        else:
            score += self.WEEKDAY_BIAS
        
        # Coach workload balance - only for full-time coaches (using 1-10 scale)
        coach_id = assignment['coach_id']
        coach = self.coaches_data.get(coach_id)
        
        if coach and coach['status'] == 'Full Time':
            coach_load = state['coach_workload'][coach_id]
            if coach_load < 5:
                score += self.UNDERUTILIZED_COACH_BONUS
        
        # Back-to-back (no turnaround) bonus for consecutive classes (using 1-10 scale)
        if self._is_back_to_back_with_existing(assignment, state):
            score += self.NO_TURNAROUND_BONUS
        
        # Same program back-to-back penalty for weekday mornings
        if self._would_create_same_program_back_to_back(assignment, state):
            score -= self.SAME_PROGRAM_BACK_TO_BACK_PENALTY
        
        # Diverse class bonus (using 1-10 scale)
        if coach_id in state['coach_levels_taught'] and assignment['level'] not in state['coach_levels_taught'][coach_id]:
            score += self.DIVERSE_CLASS_BONUS
        
        # Capacity utilization (using fixed value)
        score += assignment['capacity'] * self._CAPACITY_MULTIPLIER
        
        return score
    
    def _is_back_to_back_with_existing(self, assignment, state):
        """Check if assignment is back-to-back with existing assignment"""
        coach_id = assignment['coach_id']
        day = assignment['day']
        start_time = assignment['start_time']
        end_time = assignment['end_time']
        
        start_dt = datetime.strptime(start_time, '%H:%M')
        end_dt = datetime.strptime(end_time, '%H:%M')
        
        # Check if this class starts immediately after another class ends
        for existing in state['coach_schedules'][coach_id][day]:
            existing_end = datetime.strptime(existing['end_time'], '%H:%M')
            if abs((start_dt - existing_end).total_seconds()) <= 5 * 60:  # Within 5 minutes
                return True
        
        # Check if this class ends immediately before another class starts
        for existing in state['coach_schedules'][coach_id][day]:
            existing_start = datetime.strptime(existing['start_time'], '%H:%M')
            if abs((existing_start - end_dt).total_seconds()) <= 5 * 60:  # Within 5 minutes
                return True
        
        return False
    
    def _would_create_same_program_back_to_back(self, assignment, state):
        """Check if this assignment would create same-program back-to-back on weekday mornings"""
        # Only apply to weekdays and morning hours
        day = assignment['day']
        start_hour = int(assignment['start_time'].split(':')[0])
        
        if day not in self.weekdays or start_hour not in self.morning_hours:
            return False
        
        coach_id = assignment['coach_id']
        branch = assignment['branch']
        level = assignment['level']
        program = self.program_groups.get(level, level)
        
        # Check for existing same-program classes for this coach on this day and branch in the morning
        existing_morning_classes = state['coach_program_morning_classes'][coach_id][day][branch]
        
        for existing_class in existing_morning_classes:
            existing_program = existing_class['program']
            existing_hour = existing_class['hour']
            
            # If same program exists and hour is adjacent or same, would create back-to-back
            if existing_program == program and abs(existing_hour - start_hour) <= 1:
                return True
        
        return False
    
    def _get_enhanced_priority_requirements(self):
        """Calculate priority scores for all requirements using normalized weights"""
        requirements = []
        
        for req_key, students in self.enrollment_dict.items():
            branch, level = req_key
            
            # Calculate raw scores (0-10 range)
            scarcity_score = self._calculate_scarcity_score(req_key)
            complexity_score = self._calculate_level_complexity(level)
            size_priority = min(students / 20, 1.0) * 10  # Scale to 0-10
            
            # Calculate combined priority score using normalized weights
            priority_score = (scarcity_score * self.scarcity_weight_normalized + 
                           complexity_score * self.complexity_weight_normalized + 
                           size_priority * self.size_weight_normalized)
            
            requirements.append((req_key, {'students': students}, priority_score))
        
        requirements.sort(key=lambda x: x[2], reverse=True)
        return [(req_key, req) for req_key, req, _ in requirements]
    
    def _calculate_scarcity_score(self, req_key):
        """Calculate resource scarcity for prioritization (0-10 scale)"""
        branch, level = req_key
        
        qualified_coaches = len([c for c in self.full_time_coaches + self.part_time_coaches + self.branch_managers
                               if level in c['qualifications'] and branch in c['branches']])
        
        available_slots = len([a for a in self.popular_assignments
                             if a['branch'] == branch and a['level'] == level])
        
        # Convert to 0-10 scale
        scarcity = min(10, (50 / max(1, qualified_coaches)) + (30 / max(1, available_slots)))
        return scarcity
    
    def _calculate_level_complexity(self, level):
        """Calculate complexity score based on level hierarchy (0-10 scale)"""
        if level not in self.level_hierarchy:
            return 5.0  # Middle of scale
        
        level_index = self.level_hierarchy.index(level)
        # Convert to 0-10 scale
        return (level_index / len(self.level_hierarchy)) * 10
    
    # ==================== CONSTRAINT VALIDATION ====================
    
    def _validate_strict_workload_constraints(self, assignment, state):
        """Validate all constraints with strict workload enforcement"""
        coach_id = assignment['coach_id']
        coach = self.coaches_data[coach_id]
        day = assignment['day']
        period = assignment['period']
        branch = assignment['branch']
        start_time = assignment['start_time']
        end_time = assignment['end_time']
        duration = assignment['duration']
        
        # Basic availability check
        if not coach['availability'].get(day, {}).get(period, False):
            return False
        
        # Time conflict check
        if self._has_time_conflict(assignment, state):
            return False
        
        # One branch per day constraint
        existing_branch = state['coach_branch_daily'][coach_id][day]
        if existing_branch and existing_branch != branch:
            return False
        
        # Strict daily class limits
        current_classes = state['coach_daily_classes'][coach_id][day]
        strict_limit = self.WEEKEND_DAILY_LIMIT if day in self.weekends else self.WEEKDAY_DAILY_LIMIT
        
        if current_classes >= strict_limit:
            return False
        
        # Daily hours limits
        current_hours = state['coach_daily_hours'][coach_id][day]
        hours_limit = self.WEEKEND_DAILY_HOURS if day in self.weekends else self.WEEKDAY_DAILY_HOURS
        
        if current_hours + duration > hours_limit:
            return False
        
        # Consecutive class limits
        if not self._respects_consecutive_limits(assignment, state):
            return False
        
        # Branch capacity limits
        if not self._within_branch_capacity(assignment, state):
            return False
        
        return True
    
    def _has_time_conflict(self, assignment, state):
        """Check for overlapping time assignments"""
        coach_id = assignment['coach_id']
        day = assignment['day']
        start_time = assignment['start_time']
        end_time = assignment['end_time']
        
        new_start = datetime.strptime(start_time, '%H:%M')
        new_end = datetime.strptime(end_time, '%H:%M')
        
        for existing in state['coach_schedules'][coach_id][day]:
            existing_start = datetime.strptime(existing['start_time'], '%H:%M')
            existing_end = datetime.strptime(existing['end_time'], '%H:%M')
            
            if new_start < existing_end and existing_start < new_end:
                return True
        
        return False
    
    def _respects_consecutive_limits(self, assignment, state):
        """Check consecutive class limits with required breaks"""
        coach_id = assignment['coach_id']
        day = assignment['day']
        start_time = assignment['start_time']
        end_time = assignment['end_time']
        
        day_assignments = state['coach_schedules'][coach_id][day].copy()
        day_assignments.append({'start_time': start_time, 'end_time': end_time})
        day_assignments.sort(key=lambda x: datetime.strptime(x['start_time'], '%H:%M'))
        
        consecutive_count = 1
        
        for i in range(1, len(day_assignments)):
            prev_end = datetime.strptime(day_assignments[i-1]['end_time'], '%H:%M')
            curr_start = datetime.strptime(day_assignments[i]['start_time'], '%H:%M')
            
            gap_minutes = (curr_start - prev_end).total_seconds() / 60
            
            if gap_minutes < self.MIN_BREAK_MINUTES:
                consecutive_count += 1
                if consecutive_count > self.CONSECUTIVE_LIMIT:
                    return False
            else:
                consecutive_count = 1
        
        return True
    
    def _within_branch_capacity(self, assignment, state):
        """Check branch capacity constraints"""
        branch = assignment['branch']
        day = assignment['day']
        start_time = assignment['start_time']
        end_time = assignment['end_time']
        
        max_capacity = self.branch_limits.get(branch, 4)
        
        start_dt = datetime.strptime(start_time, '%H:%M')
        end_dt = datetime.strptime(end_time, '%H:%M')
        
        current = start_dt
        while current < end_dt:
            slot_key = current.strftime('%H:%M')
            current_usage = state['branch_time_usage'][branch][day][slot_key]
            
            if current_usage >= max_capacity:
                return False
            
            current += timedelta(minutes=30)
        
        return True
    
    # ==================== LEVEL MERGING AND COMPATIBILITY ====================
    
    def _check_level_compatibility(self, level1, level2):
        """Check if two levels can be merged based on configured distance"""
        if level1 == level2:
            return True
        
        if level1 not in self.level_hierarchy or level2 not in self.level_hierarchy:
            return False
        
        idx1 = self.level_hierarchy.index(level1)
        idx2 = self.level_hierarchy.index(level2)
        
        return abs(idx1 - idx2) <= self.LEVEL_MERGE_DISTANCE
    
    def _update_merge_info(self, assignment, new_level):
        """Update assignment with merge information"""
        if 'merged_levels' not in assignment:
            assignment['merged_levels'] = [assignment['level']]
        
        if new_level not in assignment['merged_levels']:
            assignment['merged_levels'].append(new_level)
            assignment['merged'] = 'Yes'
            assignment['merged_with'] = '+'.join(sorted(assignment['merged_levels']))
    
    def _generate_level_combinations(self, level_gaps):
        """Generate valid level combinations for multi-level classes"""
        combinations = []
        level_gaps.sort(key=lambda x: x[1], reverse=True)
        levels = [lg[0] for lg in level_gaps]
        
        for i in range(len(levels)):
            for j in range(i + 1, len(levels)):
                level1, level2 = levels[i], levels[j]
                if self._check_level_compatibility(level1, level2):
                    gap1 = next(g[1] for g in level_gaps if g[0] == level1)
                    gap2 = next(g[1] for g in level_gaps if g[0] == level2)
                    combinations.append(([level1, level2], gap1 + gap2))
        
        combinations.sort(key=lambda x: x[1], reverse=True)
        return combinations
    
    def _distribute_students_across_levels(self, levels, level_gaps, total_class_size, state):
        """Distribute students proportionally across merged levels"""
        total_gap = sum(gap for level, gap in level_gaps if level in levels)
        
        for level, gap in level_gaps:
            if level in levels and total_gap > 0:
                proportion = gap / total_gap
                assigned = int(total_class_size * proportion)
                req_key = None
                
                for key in state['unassigned_students']:
                    if key[1] == level:
                        req_key = key
                        break
                
                if req_key and assigned > 0:
                    state['unassigned_students'][req_key] = max(0, state['unassigned_students'][req_key] - assigned)
    
    # ==================== COACH MANAGEMENT ====================
    
    def _get_prioritized_coaches(self, branch, level):
        """Get qualified coaches prioritized by type and availability"""
        qualified = []
        
        for coach_list in [self.full_time_coaches, self.part_time_coaches, self.branch_managers]:
            for coach in coach_list:
                if level in coach['qualifications'] and branch in coach['branches']:
                    qualified.append(coach)
        
        qualified.sort(key=lambda c: (
            c['status'] == 'Branch Manager',
            c['status'] != 'Full Time'
        ))
        
        return qualified
    
    def _get_all_qualified_coaches(self, branch, level):
        """Get all coaches qualified for specific branch and level"""
        return [c for c in self.full_time_coaches + self.part_time_coaches + self.branch_managers
                if level in c['qualifications'] and branch in c['branches']]
    
    def _find_multi_qualified_coaches(self, branch, levels):
        """Find coaches qualified for multiple levels"""
        qualified = []
        
        for coach in self.full_time_coaches + self.part_time_coaches + self.branch_managers:
            if (branch in coach['branches'] and 
                all(level in coach['qualifications'] for level in levels)):
                qualified.append(coach)
        
        return qualified
    
    # ==================== ASSIGNMENT FINDING ====================
    
    def _find_optimal_assignment_strict(self, qualified_coaches, branch, level, state, assignment_pool):
        """Find best assignment with strict constraint validation"""
        best_assignment = None
        best_score = -1
        
        for coach in qualified_coaches:
            coach_id = coach['id']
            
            # Check weekly workload limits
            weekly_limit = self._get_coach_weekly_limit(coach)
            if state['coach_workload'][coach_id] >= weekly_limit:
                continue
            
            candidates = [a for a in assignment_pool
                         if (a['coach_id'] == coach_id and 
                             a['branch'] == branch and 
                             a['level'] == level)]
            
            for assignment in candidates:
                if self._validate_strict_workload_constraints(assignment, state):
                    score = self._score_assignment_enhanced(assignment, state)
                    if score > best_score:
                        best_score = score
                        best_assignment = assignment
        
        return best_assignment
    
    def _find_specific_coach_assignment_strict(self, coach_id, branch, level, state, assignment_pool):
        """Find assignment for specific coach with constraint validation"""
        candidates = [a for a in assignment_pool
                     if (a['coach_id'] == coach_id and 
                         a['branch'] == branch and 
                         a['level'] == level)]
        
        candidates.sort(key=lambda a: self._score_assignment_enhanced(a, state), reverse=True)
        
        for assignment in candidates:
            if self._validate_strict_workload_constraints(assignment, state):
                return assignment
        
        return None
    
    def _find_specific_coach_day_assignment_strict(self, coach_id, branch, level, day, state, assignment_pool):
        """Find assignment for specific coach on specific day"""
        candidates = [a for a in assignment_pool
                     if (a['coach_id'] == coach_id and 
                         a['branch'] == branch and 
                         a['level'] == level and
                         a['day'] == day)]
        
        for assignment in candidates:
            if self._validate_strict_workload_constraints(assignment, state):
                return assignment
        
        return None
    
    # ==================== ASSIGNMENT CREATION ====================
    
    def _add_validated_assignment_strict(self, assignment, students, state):
        """Add assignment to schedule with strict validation"""
        max_capacity = self.class_capacities.get(assignment['level'], 8)
        if students > max_capacity:
            return False
        
        if not self._validate_strict_workload_constraints(assignment, state):
            return False
        
        assignment_record = {
            'id': assignment['id'],
            'coach_id': assignment['coach_id'],
            'coach_name': assignment['coach_name'],
            'coach_status': assignment['coach_status'],
            'branch': assignment['branch'],
            'level': assignment['level'],
            'day': assignment['day'],
            'start_time': assignment['start_time'],
            'end_time': assignment['end_time'],
            'duration': assignment['duration'],
            'period': assignment['period'],
            'is_popular': assignment.get('is_popular', False),
            'capacity': assignment['capacity'],
            'actual_students': students
        }
        
        state['selected_assignments'].append(assignment_record)
        
        # Update state tracking
        coach_id = assignment['coach_id']
        day = assignment['day']
        branch = assignment['branch']
        level = assignment['level']
        
        state['coach_schedules'][coach_id][day].append(assignment_record)
        state['coach_daily_hours'][coach_id][day] += assignment['duration']
        state['coach_daily_classes'][coach_id][day] += 1
        state['coach_branch_daily'][coach_id][day] = branch
        state['coach_workload'][coach_id] += 1
        
        # Track diverse class levels taught
        if coach_id not in state['coach_levels_taught']:
            state['coach_levels_taught'][coach_id] = set()
        state['coach_levels_taught'][coach_id].add(level)
        
        # Track morning program classes for same-program back-to-back detection
        start_hour = int(assignment['start_time'].split(':')[0])
        if day in self.weekdays and start_hour in self.morning_hours:
            program = self.program_groups.get(level, level)
            state['coach_program_morning_classes'][coach_id][day][branch].append({
                'program': program,
                'level': level,
                'hour': start_hour,
                'time': assignment['start_time']
            })
        
        # Update branch time usage
        start_dt = datetime.strptime(assignment['start_time'], '%H:%M')
        end_dt = datetime.strptime(assignment['end_time'], '%H:%M')
        
        current = start_dt
        while current < end_dt:
            slot_key = current.strftime('%H:%M')
            state['branch_time_usage'][branch][day][slot_key] += 1
            current += timedelta(minutes=30)
        
        return True
    
    # ==================== UTILITY FUNCTIONS ====================
    
    def _enhanced_adaptive_shuffle(self):
        """Shuffle assignments for better exploration"""
        print("  Enhanced adaptive shuffling...")
        random.shuffle(self.popular_assignments)
        random.shuffle(self.full_time_coaches)
        random.shuffle(self.part_time_coaches)
        random.shuffle(self.branch_managers)
    
    def _count_workload_violations(self, result):
        """Count workload constraint violations"""
        violations = 0
        
        coach_daily_classes = defaultdict(lambda: defaultdict(int))
        for entry in result['schedule']:
            coach_id = entry['Coach ID']
            day = entry['Day']
            coach_daily_classes[coach_id][day] += 1
        
        for coach_id, daily_counts in coach_daily_classes.items():
            for day, count in daily_counts.items():
                limit = self.WEEKEND_DAILY_LIMIT if day in self.weekends else self.WEEKDAY_DAILY_LIMIT
                
                if count > limit:
                    violations += 1
                    print(f"  WORKLOAD VIOLATION: Coach {coach_id} has {count} classes on {day} (limit: {limit})")
        
        return violations
    
    def _count_violations(self, result):
        """Count general constraint violations"""
        violations = 0
        
        # Check class capacities
        for entry in result['schedule']:
            level = entry['Gymnastics Level']
            students = entry['Students']
            max_capacity = self.class_capacities.get(level, 8)
            
            if students > max_capacity:
                violations += 1
        
        # Check branch assignments (one branch per day)
        coach_day_branches = defaultdict(lambda: defaultdict(set))
        for entry in result['schedule']:
            coach_id = entry['Coach ID']
            day = entry['Day']
            branch = entry['Branch']
            coach_day_branches[coach_id][day].add(branch)
        
        for coach_id, day_branches in coach_day_branches.items():
            for day, branches in day_branches.items():
                if len(branches) > 1:
                    violations += 1
        
        # Check consecutive limits
        coach_day_assignments = defaultdict(lambda: defaultdict(list))
        for entry in result['schedule']:
            coach_id = entry['Coach ID']
            day = entry['Day']
            coach_day_assignments[coach_id][day].append(entry)
        
        for coach_id, day_assignments in coach_day_assignments.items():
            for day, assignments in day_assignments.items():
                if len(assignments) > 1:
                    assignments.sort(key=lambda x: datetime.strptime(x['Start Time'], '%H:%M'))
                    
                    consecutive_count = 1
                    for i in range(1, len(assignments)):
                        prev_end = datetime.strptime(assignments[i-1]['End Time'], '%H:%M')
                        curr_start = datetime.strptime(assignments[i]['Start Time'], '%H:%M')
                        
                        gap_minutes = (curr_start - prev_end).total_seconds() / 60
                        
                        if gap_minutes < self.MIN_BREAK_MINUTES:
                            consecutive_count += 1
                            if consecutive_count > self.CONSECUTIVE_LIMIT:
                                violations += 1
                                break
                        else:
                            consecutive_count = 1
        
        return violations
    
    def _identify_gaps(self, result):
        """Identify unmet student requirements"""
        scheduled_students = defaultdict(int)
        
        for entry in result['schedule']:
            key = (entry['Branch'], entry['Gymnastics Level'])
            scheduled_students[key] += entry['Students']
        
        gaps = []
        for req_key, required in self.enrollment_dict.items():
            scheduled = scheduled_students.get(req_key, 0)
            if scheduled < required:
                gaps.append((req_key, required - scheduled))
        
        return gaps
    
    def _build_and_validate_result(self, state):
        """Build final schedule and calculate statistics"""
        schedule = []
        for assignment in state['selected_assignments']:
            entry = {
                'Branch': assignment['branch'],
                'Day': assignment['day'],
                'Start Time': assignment['start_time'],
                'End Time': assignment['end_time'],
                'Gymnastics Level': assignment['level'],
                'Coach ID': assignment['coach_id'],
                'Coach Name': assignment['coach_name'],
                'Coach Status': assignment['coach_status'],
                'Students': assignment['actual_students'],
                'Capacity': assignment['capacity'],
                'Duration (min)': assignment['duration'],
                'Popular Slot': 'Yes' if assignment.get('is_popular', False) else 'No',
                'Merged': assignment.get('merged', 'No'),
                'Merged With': assignment.get('merged_with', '')
            }
            schedule.append(entry)
        
        # Sort schedule chronologically
        day_order = {'TUE': 0, 'WED': 1, 'THU': 2, 'FRI': 3, 'SAT': 4, 'SUN': 5}
        schedule.sort(key=lambda x: (day_order.get(x['Day'], 6), x['Start Time'], x['Branch']))
        
        # Calculate statistics
        total_students_scheduled = sum(entry['Students'] for entry in schedule)
        coverage_percentage = (total_students_scheduled / self.total_students_required * 100) if self.total_students_required > 0 else 0
        
        # Coach utilization statistics
        coach_workload = defaultdict(int)
        for entry in schedule:
            coach_workload[entry['Coach ID']] += 1
        
        coach_utilization = {}
        for status in ['Full Time', 'Part Time', 'Branch Manager']:
            status_coaches = [c for c in self.coaches_data.values() if c['status'] == status]
            total_coaches = len(status_coaches)
            
            total_classes = sum(coach_workload.get(c['id'], 0) for c in status_coaches)
            coaches_used = len([c for c in status_coaches if coach_workload.get(c['id'], 0) > 0])
            
            avg_classes = total_classes / total_coaches if total_coaches > 0 else 0
            utilization_rate = coaches_used / total_coaches * 100 if total_coaches > 0 else 0
            
            coach_utilization[status] = {
                'total_coaches': total_coaches,
                'coaches_used': coaches_used,
                'total_classes': total_classes,
                'avg_classes_per_coach': avg_classes,
                'utilization_rate': utilization_rate
            }
        
        return {
            'schedule': schedule,
            'statistics': {
                'total_classes': len(schedule),
                'total_students_scheduled': total_students_scheduled,
                'total_students_required': self.total_students_required,
                'coverage_percentage': coverage_percentage,
                'perfect_coverage': coverage_percentage >= 100.0,
                'coach_utilization': coach_utilization,
                'popular_slots_used': len([s for s in schedule if s['Popular Slot'] == 'Yes']),
                'total_slots': len(schedule),
                'merged_classes': len([s for s in schedule if s['Merged'] == 'Yes'])
            },
            'success': True
        }
    
    def _create_best_effort_strict_result(self):
        """Create fallback result with strict constraint enforcement"""
        print("Creating best effort result with strict workload limits...")
        
        state = self._initialize_enhanced_state()
        
        for req_key, students in self.enrollment_dict.items():
            branch, level = req_key
            
            qualified_coaches = self._get_all_qualified_coaches(branch, level)
            if qualified_coaches:
                assignment = self._find_optimal_assignment_strict(qualified_coaches, branch, level, state, self.popular_assignments)
                
                if assignment:
                    capacity = self.class_capacities.get(level, 8)
                    class_size = min(students, capacity)
                    if self._add_validated_assignment_strict(assignment, class_size, state):
                        state['unassigned_students'][req_key] = students - class_size
        
        return self._build_and_validate_result(state)


def execute_enhanced_strict_constraint_scheduling(data):
    """Execute the enhanced scheduling algorithm"""
    scheduler = EnhancedStrictConstraintScheduler(data)
    return scheduler.schedule_with_complete_coverage()